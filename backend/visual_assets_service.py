import fitz
import os
import uuid
import hashlib
import base64
import json
from PIL import Image
from database import get_connection
from openai import OpenAI
import numpy as np
from sklearn.cluster import KMeans

client = OpenAI()

UPLOAD_DIR = "visual_assets"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ---------------------------------------------------
# Extract unique images from PDF
# ---------------------------------------------------
def extract_images_from_pdf(file_path):

    doc = fitz.open(file_path)
    extracted_files = []
    seen_hashes = set()

    for page_index in range(len(doc)):
        page = doc[page_index]

        for img in page.get_images(full=True):

            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]

            # Prevent duplicate images
            img_hash = hashlib.md5(image_bytes).hexdigest()

            if img_hash in seen_hashes:
                continue

            seen_hashes.add(img_hash)

            image_ext = base_image["ext"]

            filename = f"{uuid.uuid4()}.{image_ext}"
            filepath = os.path.join(UPLOAD_DIR, filename)

            with open(filepath, "wb") as f:
                f.write(image_bytes)

            extracted_files.append(filepath)

    return extracted_files


# ---------------------------------------------------
# Filter obvious garbage images
# ---------------------------------------------------
def filter_visual_asset(image_path):

    try:
        img = Image.open(image_path)
        width, height = img.size
    except:
        return False

    # Too small
    if width < 80 or height < 80:
        return False

    # Extremely tall fragments
    if height > width * 3:
        return False

    # Extremely wide separators
    if width > height * 6:
        return False

    # Very large page captures
    if width > 800 or height > 800:
        return False

    return True

# ---------------------------------------------------
# Extract brand colors
# ---------------------------------------------------
def extract_brand_colors(image_paths, k=4):

    pixels = []

    for path in image_paths:

        try:
            img = Image.open(path).convert("RGB")
            img = img.resize((150, 150))

            arr = np.array(img).reshape(-1, 3)
            pixels.append(arr)

        except:
            continue

    if len(pixels) == 0:
        return []

    pixels = np.vstack(pixels)

    kmeans = KMeans(n_clusters=k, n_init=10)
    kmeans.fit(pixels)

    colors = kmeans.cluster_centers_

    hex_colors = [
        '#%02x%02x%02x' % tuple(map(int, color))
        for color in colors
    ]

    return hex_colors

# ---------------------------------------------------
# LLM classification
# ---------------------------------------------------
def classify_icon_with_llm(image_path):

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": """
You classify pharmaceutical marketing visual assets.

Categories:
icon
logo
chart
background
decoration
other

Return ONLY valid JSON:

{
  "type": "...",
  "description": "short explanation"
}
"""
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Classify this image"},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        temperature=0
    )

    content = response.choices[0].message.content.strip()

    # Remove markdown wrappers if present
    if content.startswith("```"):
        parts = content.split("```")
        if len(parts) >= 2:
            content = parts[1]

    try:
        return json.loads(content)
    except:
        return {
            "type": "other",
            "description": "unrecognized asset"
        }


# ---------------------------------------------------
# Store asset in DB
# ---------------------------------------------------
def store_visual_asset(asset_type, file_path, description):

    conn = get_connection()
    cur = conn.cursor()

    query = """
    INSERT INTO visual_assets (asset_type, file_path, description)
    VALUES (%s, %s, %s)
    """

    cur.execute(query, (asset_type, file_path, description))

    conn.commit()
    cur.close()
    conn.close()


# ---------------------------------------------------
# Main pipeline
# ---------------------------------------------------
# ---------------------------------------------------
# Main pipeline
# ---------------------------------------------------
def process_style_guide(pdf_path):

    images = extract_images_from_pdf(pdf_path)

    detected_assets = []

    for img in images:

        # Filter garbage images
        if not filter_visual_asset(img):
            continue

        try:
            llm_result = classify_icon_with_llm(img)

            asset_type = llm_result["type"]
            description = llm_result["description"]

        except:
            continue

        # Skip decorative elements
        if asset_type in ["background", "decoration", "other"]:
            continue

        store_visual_asset(asset_type, img, description)

        detected_assets.append({
            "type": asset_type,
            "description": description,
            "file_path": os.path.basename(img)
        })

    # Limit assets returned to UI
    detected_assets = detected_assets[:15]

    # Extract brand colors from images
    image_paths = [os.path.join(UPLOAD_DIR, a["file_path"]) for a in detected_assets]

    brand_colors = extract_brand_colors(image_paths)

    return {
        "detected_assets": detected_assets,
        "brand_colors": brand_colors
    }