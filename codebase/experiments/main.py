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

# List of YouTube video links
video_links = [
    'https://www.youtube.com/watch?v=gUfh3Wab5gc',
]

# Replace with your YouTube API key
API_KEY = 'AIzaSyB6JGuL-ZBjktdi_viZAdwo-xvJnNVGNz8'


ROBERTA_MODEL = f"cardiffnlp/twitter-roberta-base-sentiment-latest"
DISTILBERT_MODEL = f"AdamCodd/distilbert-base-uncased-finetuned-sentiment-amazon"
rb_tokenizer = AutoTokenizer.from_pretrained(ROBERTA_MODEL)
db_tokenizer = AutoTokenizer.from_pretrained(DISTILBERT_MODEL)
# PT
rb_model = AutoModelForSequenceClassification.from_pretrained(ROBERTA_MODEL)
db_model = AutoModelForSequenceClassification.from_pretrained(DISTILBERT_MODEL)
rb_config = AutoConfig.from_pretrained(ROBERTA_MODEL)
db_config = AutoConfig.from_pretrained(DISTILBERT_MODEL)

# Function to extract video ID from YouTube video link
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

# Initialize the sentiment analyzer
analyser = SentimentIntensityAnalyzer()

# Function to perform sentiment analysis using VADER
def sentiment_analyzer_scores(sentence, model1, model2, model1_tokeniser, model2_tokeniser):
    vader_score = analyser.polarity_scores(sentence)
    vader_score.pop("compound")
    vader_result = max(vader_score.items(), key=operator.itemgetter(1))[0]

    rb_encoded_input = model1_tokeniser(sentence, truncation=True, max_length=511, return_tensors='pt')
    print(rb_encoded_input['input_ids'].size())
    print("CALCAU:ATING ROBERTA")
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
# Initialize an empty DataFrame for the output
result_df = pd.DataFrame(columns=["Comment", "Pred_sentiment"])

data_list = {}

# Initialize a list to store comments and corresponding sentiments
data_list = []

# Iterate over video links, get comments, and perform sentiment analysis
for link in video_links:
    vader_cnt_neu = 0
    vader_cnt_neg = 0
    vader_cnt_pos = 0
    rb_cnt_neu = 0
    rb_cnt_neg = 0
    rb_cnt_pos = 0
    db_cnt_neu = 0
    db_cnt_neg = 0
    db_cnt_pos = 0

    video_id = extract_video_id(link)
    if video_id:
        comments = get_video_comments(API_KEY, video_id)
        #comments = ["Covid cases are increasing fast!", "This product doesn't fit me at all."]
        for comment in comments:
            print("Comment: ", comment)
            vader_result, rb_result, db_result = sentiment_analyzer_scores(comment, rb_model, db_model, rb_tokenizer, db_tokenizer)
            
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
        print(results_dict)
            
# # Create DataFrame from the list of lists
# result_df = pd.DataFrame(data_list, columns=["Comment", "Pred_sentiment"])


# # Save the output DataFrame to a new CSV file
# result_df.to_csv('data/comments_output_vader.csv', sep=";", index=False)
# print('Comments and sentiment saved to comments_output_vader.csv')