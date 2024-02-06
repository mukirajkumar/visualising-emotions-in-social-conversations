from datetime import datetime
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

def get_video_comments(api_key, video_id):
    youtube = build('youtube', 'v3', developerKey=api_key)
    print("Getting comments for video: ", video_id)
    comments_with_dates = []
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
                try:
                    snippet = item.get('snippet', {})  # Use get to handle cases where 'snippet' is not present
                    topLevelComment = snippet.get('topLevelComment', {}).get('snippet', {})
                    
                    comment = topLevelComment.get('textDisplay', '')
                    comment_date_str = topLevelComment.get('publishedAt', '')
                    
                    # Convert the comment date string to a datetime object
                    comment_date = datetime.strptime(comment_date_str, "%Y-%m-%dT%H:%M:%SZ").date() if comment_date_str else None

                    comments_with_dates.append({
                        'comment': comment,
                        'date': comment_date
                    })
                except Exception as e:
                    print("Error accessing properties:", e)
                    continue  # Skip this iteration if there's an error getting properties of one of the items
            
            # Get the token for the next page of results

            next_page_token = response.get('nextPageToken')

            if not next_page_token:
                break  # No more pages

    except HttpError as e:
        print(f'An HTTP error occurred: {e}')
    
    print("Comments retrieved successfully for video: ", video_id)
    return comments_with_dates


# Function to perform sentiment analysis using VADER
def sentiment_analyzer_scores(sentence, analyser):
    vader_score = analyser.polarity_scores(sentence)
    
    # Extract and return the compound score
    compound_score = vader_score["compound"]
    return compound_score
