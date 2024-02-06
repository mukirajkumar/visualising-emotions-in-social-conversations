from flask import Flask, request, jsonify
import io, json
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
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Replace with your YouTube API key
API_KEY = 'AIzaSyB6JGuL-ZBjktdi_viZAdwo-xvJnNVGNz8'
analyser = SentimentIntensityAnalyzer()


@app.route('/api/youtube_sentiment', methods=['POST'])
def analyze_sentiment():
    try:
        print("plswork")
        compound_scores = []
        dates = []

        # Assuming the input data is sent as JSON
        link = request.get_json()
        print("json")
        print(type(link["url"]))
        video_id = services.extract_video_id(link["url"])
        print("extracted video id")
        if video_id:
            comments_with_dates = services.get_video_comments(API_KEY, video_id)
            # comments_with_dates is a list, so iterate over each item directly
            for comment_with_date in comments_with_dates:
                comment = comment_with_date['comment']
                date = comment_with_date['date']
                print("comment: ", comment)
                compound_score = services.sentiment_analyzer_scores(comment, analyser)
                compound_scores.append(compound_score)
                dates.append(date.strftime('%Y-%m-%d'))  # Format date as needed
                
            results_dict = {"dates": dates, "compound_scores": compound_scores}
            
            # Print the JSON output to the console

        with io.open('json_output.txt', 'w', encoding='utf-8') as f:
            f.write(json.dumps(results_dict, ensure_ascii=False))

            return jsonify(results_dict)

    except Exception as e:
        return jsonify({'error': str(e)})


if __name__ == '__main__':
    app.run(debug=True)
