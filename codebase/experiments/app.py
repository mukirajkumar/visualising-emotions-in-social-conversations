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
analyser = SentimentIntensityAnalyzer()


@app.route('/api/youtube_sentiment', methods=['POST'])
def analyze_sentiment():
    try:
        compound_scores = []
        dates = []

        # Assuming the input data is sent as JSON
        link = request.get_json()
        video_id = services.extract_video_id(link["link"])
        if video_id:
            comments_with_dates = services.get_video_comments(API_KEY, video_id)
            #comments = ["Covid cases are increasing fast!", "This product doesn't fit me at all."]
            for comment_with_date in comments_with_dates['comment']:
                comment = comment_with_date['comment']
                date = comment_with_date['date']
                
                compound_score = services.sentiment_analyzer_scores(comment, analyser)
                compound_scores.append(compound_score)
                dates.append(date.strftime('%Y-%m-%d'))  # Format date as needed
                
            results_dict = {"dates": dates, "compound_scores": compound_scores}
            return jsonify(results_dict)

    except Exception as e:
        return jsonify({'error': str(e)})

if __name__ == '__main__':
    app.run(debug=True)
