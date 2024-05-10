import re
import pandas as pd
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from transformers import AutoModelForSequenceClassification, AutoTokenizer, AutoConfig
import numpy as np
from scipy.special import softmax
import time

# Replace with your YouTube API key
API_KEY = 'AIzaSyB6JGuL-ZBjktdi_viZAdwo-xvJnNVGNz8'

# List of YouTube video links
video_links = [
    'https://www.youtube.com/watch?v=gUfh3Wab5gc',
]

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



from transformers import AutoModelForSequenceClassification, AutoTokenizer, AutoConfig
# Preprocess text and encode it, handling long inputs
def preprocess_and_encode(text):
    print(text)
    max_length = 512  # Maximum token limit of the model
    # Tokenize the text
    tokenized_text = tokenizer(text, return_tensors='pt', max_length=max_length, truncation = True, padding='max_length')
    return tokenized_text

# Sentiment analysis
MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest"
tokenizer = AutoTokenizer.from_pretrained(MODEL)
config = AutoConfig.from_pretrained(MODEL)
model = AutoModelForSequenceClassification.from_pretrained(MODEL)

start_time = time.time()
# Initialize an empty list to store the results
data_list = []

# Iterate over video links, get comments, and perform sentiment analysis
for link in video_links:
    video_id = extract_video_id(link)
    if video_id:
        comments = get_video_comments(API_KEY, video_id)

        for comment in comments:
            # Perform sentiment analysis on the review text using RoBERTa
            encoded_inputs = preprocess_and_encode(comment)
            output = model(**encoded_inputs)
            scores = output[0][0].detach().numpy()
            scores = softmax(scores)
            negative, neutral, positive = scores

            # Append the results to the list
            data_list.append({"Comment": comment, "Negative": negative, "Neutral": neutral, "Positive": positive})

# Create a DataFrame from the list of dictionaries
result_df = pd.DataFrame(data_list)
print(result_df.head(10))
end_time = time.time()
# Calculate duration
duration = end_time - start_time
print("Runtime: ", duration)

# Save the output DataFrame to a new CSV file
result_df.to_csv('data/comments_output_roberta.csv', sep=";", index=False)
print('Comments and sentiment saved to comments_output_sentiment.csv')
