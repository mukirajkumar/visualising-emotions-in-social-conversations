import re
import pandas as pd
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from transformers import pipeline, AutoTokenizer
import numpy as np
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

# Create the sentiment classification pipeline
sentiment_classifier = pipeline('text-classification', model='AdamCodd/distilbert-base-uncased-finetuned-sentiment-amazon')
tokenizer = AutoTokenizer.from_pretrained("AdamCodd/distilbert-base-uncased-finetuned-sentiment-amazon")

# Function to preprocess text and encode it with sliding window approach
def preprocess_and_encode(text):
    max_length = 512  # Maximum token limit of the model
    
    if len(text) > max_length:
        # Sliding window approach
        window_size = max_length
        step = max_length // 2
        parts = [text[i:i+window_size] for i in range(0, len(text) - window_size + 1, step)]
    else:
        parts = [text]
    
    encoded_inputs = []
    for part in parts:
        encoded_input = tokenizer(part, return_tensors='pt', truncation=True, padding='max_length', max_length=max_length)
        encoded_inputs.append(encoded_input)
    return encoded_inputs

start_time = time.time()
# Initialize an empty list to store the results
data_list = []

sentiment_classifier = pipeline('text-classification', model='AdamCodd/distilbert-base-uncased-finetuned-sentiment-amazon')
tokenizer = AutoTokenizer.from_pretrained("AdamCodd/distilbert-base-uncased-finetuned-sentiment-amazon")
# Iterate over video links, get comments, and perform sentiment analysis
for link in video_links:
    video_id = extract_video_id(link)
    if video_id:
        comments = get_video_comments(API_KEY, video_id)

        for comment in comments:
            # Perform sentiment analysis on the review text using sliding window approach
            encoded_inputs = preprocess_and_encode(comment)
            max_length = 512
            for encoded_input in encoded_inputs:
                # Extract input IDs
                input_ids = encoded_input['input_ids']
                if len(input_ids[0]) > max_length:
                    input_ids = input_ids[:, :max_length]  # Truncate the input sequence if it exceeds the maximum length
                # Pass the input IDs to the sentiment classifier
                sentence = tokenizer.decode(input_ids[0], skip_special_tokens=True)
                result = sentiment_classifier(sentence)
                try:
                    score = result[0]['score']  # Get the score for the sentiment
                    label = result[0]['label']  # Assign label based on score
                    # Append the results to the list
                    data_list.append({"Comment": comment, "Sentiment": label, "Confidence Score": score})
                except Exception as e:
                    print("Error processing result:", e)

# Create a DataFrame from the list of dictionaries
result_df = pd.DataFrame(data_list)
print(result_df.head(10))
end_time = time.time()
# Calculate duration
duration = end_time - start_time
print("Runtime: ", duration)

# Save the output DataFrame to a new CSV file
result_df.to_csv('data/comments_output_distilbert.csv', sep=";", index=False)
print('Comments and sentiment saved to comments_output_sentiment.csv')
