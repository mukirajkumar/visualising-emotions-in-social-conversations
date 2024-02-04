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


def extract_video_id(link):
    video_id_match = re.search(r'(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})', link)
    if video_id_match:
        return video_id_match.group(1)
    else:
        return None

# Function to get comments for a video using YouTube Data API with pagination
def get_video_comments(api_key, video_id):
    youtube = build('youtube', 'v3', developerKey=api_key)
    print("Getting comments for video: ", video_id)
    comments = []
    next_page_token = None
    
    try:
        while True:
            response = youtube.commentThreads().list(
                part='snippet',
                videoId=video_id,
                textFormat='plainText',
                pageToken=next_page_token
            ).execute()

            for item in response['items']:
                comment = item['snippet']['topLevelComment']['snippet']['textDisplay']
                comments.append(comment)

            next_page_token = response.get('nextPageToken')

            if not next_page_token:
                break  # No more pages

    except HttpError as e:
        print(f'An HTTP error occurred: {e}')
    print("Comments retrieved successfully for video: ", video_id)
    return comments


# Function to perform sentiment analysis using VADER
def sentiment_analyzer_scores(sentence, model1, model2, model1_tokeniser, model2_tokeniser, rb_config, db_config, analyser):
    vader_score = analyser.polarity_scores(sentence)
    vader_score.pop("compound")
    vader_result = max(vader_score.items(), key=operator.itemgetter(1))[0]

    rb_encoded_input = model1_tokeniser(sentence, truncation=True, max_length=511, return_tensors='pt')
    output = model1(**rb_encoded_input)
    rb_scores = output[0][0].detach().numpy()
    rb_scores = softmax(rb_scores)
    rb_highest_score = np.argmax(rb_scores) 
    rb_result = rb_config.id2label[rb_highest_score]

    db_encoded_input = model2_tokeniser(sentence, truncation=True, max_length=511, return_tensors='pt')
    print(db_encoded_input['input_ids'].size())
    db_output = model2(**db_encoded_input)
    db_scores = db_output[0][0].detach().numpy()
    db_scores = softmax(db_scores)
    db_highest_score = np.argmax(db_scores) 
    db_result = db_config.id2label[db_highest_score]


    return vader_result, rb_result, db_result
