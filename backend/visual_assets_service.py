import fitz
import os
import uuid
from PIL import Image
from database import get_connection
import fitz


UPLOAD_DIR = "visual_assets"

os.makedirs(UPLOAD_DIR, exist_ok=True)


def extract_images_from_pdf(file_path):

    doc = fitz.open(file_path)
    extracted_files = []

    for page_index in range(len(doc)):
        page = doc[page_index]

        for img in page.get_images():

            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image["ext"]

            filename = f"{uuid.uuid4()}.{image_ext}"
            filepath = os.path.join(UPLOAD_DIR, filename)

            with open(filepath, "wb") as f:
                f.write(image_bytes)

            extracted_files.append(filepath)

    return extracted_files


def classify_visual_asset(image_path):

    img = Image.open(image_path)
    width, height = img.size

    ratio = width / height

    if ratio > 2:
        return "logo"

    if width < 150 and height < 150:
        return "icon"

    return "chart"


def store_visual_asset(asset_type, file_path):

    conn = get_connection()
    cur = conn.cursor()

    query = """
    INSERT INTO visual_assets (asset_type, file_path)
    VALUES (%s, %s)
    """

    cur.execute(query, (asset_type, file_path))

    conn.commit()
    cur.close()
    conn.close()


def process_style_guide(pdf_path):

    images = extract_images_from_pdf(pdf_path)

    detected_assets = []

    for img in images:

        asset_type = classify_visual_asset(img)

        store_visual_asset(asset_type, img)

        detected_assets.append({
            "type": asset_type,
            "file_path": img
        })

    return detected_assets
