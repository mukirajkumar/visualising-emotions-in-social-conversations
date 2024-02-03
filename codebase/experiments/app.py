from flask import Flask, request, jsonify
import re
import openpyxl
import pandas as pd
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import argparse
import operator
from transformers import pipeline
from transformers import AutoModelForSequenceClassification
from transformers import TFAutoModelForSequenceClassification
from transformers import AutoTokenizer, AutoConfig
import numpy as np
from scipy.special import softmax
from transformers import DistilBertTokenizerFast
import services

app = Flask(__name__)

# Replace with your YouTube API key
API_KEY = 'AIzaSyB6JGuL-ZBjktdi_viZAdwo-xvJnNVGNz8'
ROBERTA_MODEL = f"cardiffnlp/twitter-roberta-base-sentiment-latest"
DISTILBERT_MODEL = f"AdamCodd/distilbert-base-uncased-finetuned-sentiment-amazon"
rb_tokenizer = AutoTokenizer.from_pretrained(ROBERTA_MODEL)
db_tokenizer = AutoTokenizer.from_pretrained(DISTILBERT_MODEL)
# PT
rb_model = AutoModelForSequenceClassification.from_pretrained(ROBERTA_MODEL)
db_model = AutoModelForSequenceClassification.from_pretrained(DISTILBERT_MODEL)
analyser = SentimentIntensityAnalyzer()
rb_config = AutoConfig.from_pretrained(ROBERTA_MODEL)
db_config = AutoConfig.from_pretrained(DISTILBERT_MODEL)

@app.route('/api/youtube_sentiment', methods=['POST'])
def analyze_sentiment():
    try:
        vader_cnt_neu = 0
        vader_cnt_neg = 0
        vader_cnt_pos = 0
        rb_cnt_neu = 0
        rb_cnt_neg = 0
        rb_cnt_pos = 0
        db_cnt_neu = 0
        db_cnt_neg = 0
        db_cnt_pos = 0
        # Assuming the input data is sent as JSON
        link = request.get_json()
        video_id = services.extract_video_id(link["link"])
        if video_id:
            comments = services.get_video_comments(API_KEY, video_id)
            #comments = ["Covid cases are increasing fast!", "This product doesn't fit me at all."]
            for comment in comments:
                print("Comment: ", comment)
                vader_result, rb_result, db_result = services.sentiment_analyzer_scores(comment, rb_model, db_model, rb_tokenizer, db_tokenizer, rb_config, db_config, analyser)
                
                print("VADER Result: ", vader_result)
                print("RoBERTa Result: ", rb_result)
                print("DistilBERT Result: ", db_result)

                if vader_result == "neu":
                    vader_cnt_neu += 1
                if vader_result == "neg":
                    vader_cnt_neg +=1
                if vader_result == "pos":
                    vader_cnt_pos += 1

                if rb_result == "neutral":
                    rb_cnt_neu += 1
                if rb_result =="negative":
                    rb_cnt_neg += 1
                if rb_result == "positive":
                    rb_cnt_pos += 1

                if db_result == "neutral":
                    db_cnt_neu += 1
                if db_result =="negative":
                    db_cnt_neg += 1
                if db_result == "positive":
                    db_cnt_pos += 1
            results_dict = {"vader": [vader_cnt_neg, vader_cnt_neu, vader_cnt_pos],
                            "roberta": [rb_cnt_neg, rb_cnt_neu, rb_cnt_pos],
                            "distilbert": [db_cnt_neg, db_cnt_neu, db_cnt_pos]}

            return jsonify(results_dict)

    except Exception as e:
        return jsonify({'error': str(e)})

if __name__ == '__main__':
    app.run(debug=True)
