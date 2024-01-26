import pandas as pd

def clean_csv(input_path, output_path, delimiter=',', encoding='utf-8'):
    # Read the CSV file with specified encoding and delimiter
    df = pd.read_csv(input_path, delimiter=delimiter, encoding=encoding, engine='python')
    
    # Drop empty lines
    df = df.dropna(how='all')

    # Drop lines with inconsistent structure
    df = df.dropna(subset=[df.columns[0]])

    # Save the cleaned DataFrame to a new CSV file
    df.to_csv(output_path, sep=delimiter, index=False, encoding=encoding)

# Example usage:
clean_csv('data/youtube_comments.csv', 'data/cleaned_youtube_comments.csv', delimiter=';', encoding='ISO-8859-1')
