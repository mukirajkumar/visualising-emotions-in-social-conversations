import re
import openpyxl
import pandas as pd
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import argparse
import operator

# Replace with your YouTube API key
API_KEY = 'AIzaSyB6JGuL-ZBjktdi_viZAdwo-xvJnNVGNz8'

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
def sentiment_analyzer_scores(sentence):
    score = analyser.polarity_scores(sentence)
    score.pop("compound")
    return score

# List of YouTube video links
video_links = [
    'https://www.youtube.com/watch?v=gUfh3Wab5gc',
    'https://www.youtube.com/watch?v=QIEDz9ZoTOw',
    'https://www.youtube.com/watch?v=Xbi_o4JGOow',
    'https://www.youtube.com/watch?v=KudedLV0tP0'
]

# Initialize an empty DataFrame for the output
result_df = pd.DataFrame(columns=["Comment", "Pred_sentiment"])

# Iterate over video links, get comments, and perform sentiment analysis
for link in video_links:
    video_id = extract_video_id(link)
    if video_id:
        comments = get_video_comments(API_KEY, video_id)

        for comment in comments:
            # Perform sentiment analysis on the review text using VADER
            sentimentData_sentence1 = sentiment_analyzer_scores(comment)

            # Assign the sentiment with the highest score as the predicted sentiment
            pred_sentiment = max(sentimentData_sentence1.items(), key=operator.itemgetter(1))[0]

            # Add new columns to the result_df DataFrame
            result_df["Comment"] = comment
            result_df["Pred_sentiment"] = pred_sentiment

# Save the output DataFrame to a new CSV file
result_df.to_csv('comments_output_vader.csv', sep=";", index=False)
print('Comments and sentiment saved to comments_output_vader.csv')