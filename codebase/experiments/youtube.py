import re
import openpyxl
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

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
    
    return comments

# List of YouTube video links
video_links = [
    'https://www.youtube.com/watch?v=gUfh3Wab5gc',
    'https://www.youtube.com/watch?v=QIEDz9ZoTOw',
    'https://www.youtube.com/watch?v=Xbi_o4JGOow',
    'https://www.youtube.com/watch?v=KudedLV0tP0'
]

# Create Excel workbook and sheet
workbook = openpyxl.Workbook()
sheet = workbook.active

# Iterate over video links, get comments, and write to Excel file
for link in video_links:
    video_id = extract_video_id(link)
    if video_id:
        comments = get_video_comments(API_KEY, video_id)

        sheet.append([f'Comments for Video ({link})'])
        for comment in comments:
            sheet.append([comment])
        sheet.append([])  # Add an empty row between videos for clarity

# Save Excel workbook
workbook.save('youtube_comments.xlsx')

print('Comments saved to youtube_comments.xlsx')
