from transformers import pipeline

# Create the pipeline
sentiment_classifier = pipeline('text-classification', model='AdamCodd/distilbert-base-uncased-finetuned-sentiment-amazon')

# Now you can use the pipeline to get the sentiment
result = sentiment_classifier("This product doesn't fit me at all.")
print(result)