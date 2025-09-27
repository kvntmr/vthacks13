#!/bin/bash

# Script to install Tesseract English language data
echo "Installing Tesseract English language data..."

# Check if tessdata directory exists
if [ ! -d "/usr/share/tessdata" ]; then
    echo "Error: /usr/share/tessdata directory not found"
    exit 1
fi

# Download English language data
echo "Downloading eng.traineddata..."
curl -L -o /tmp/eng.traineddata https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata

if [ $? -eq 0 ]; then
    echo "Download successful"
    
    # Copy to tessdata directory (requires sudo)
    echo "Copying to /usr/share/tessdata/ (requires sudo password)..."
    sudo cp /tmp/eng.traineddata /usr/share/tessdata/
    
    if [ $? -eq 0 ]; then
        echo "✅ English language data installed successfully!"
        echo "You can now use OCR functionality in the PowerPoint parser."
    else
        echo "❌ Failed to copy file. Please run manually:"
        echo "sudo cp /tmp/eng.traineddata /usr/share/tessdata/"
    fi
    
    # Clean up
    rm /tmp/eng.traineddata
else
    echo "❌ Failed to download language data"
    exit 1
fi

