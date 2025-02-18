from PIL import Image
import os

# Define the root folder to search for images
root_folder = "assets/brands"

# Loop through all files and subdirectories recursively for conversion
for foldername, _, filenames in os.walk(root_folder):
    for filename in filenames:
        if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            filepath = os.path.join(foldername, filename)

            # Define the new WebP file path (same folder, same name, different extension)
            webp_filepath = os.path.splitext(filepath)[0] + ".webp"

            # Check if WebP already exists to avoid reconverting
            if os.path.exists(webp_filepath):
                print(f"Skipping (WebP Exists): {filepath}")
                continue  # Skip to the next file

            # Open the image and convert
            image = Image.open(filepath)
            if filename.lower().endswith('.png'):
                image.save(webp_filepath, format="WEBP", lossless=True)  # Lossless PNG conversion
            else:
                image.save(webp_filepath, format="WEBP", quality=95, method=6)  # High-quality JPEG conversion

            print(f"✅ Converted: {filepath} → {webp_filepath}")

print("🚀 Conversion complete! WebP images are ready.")