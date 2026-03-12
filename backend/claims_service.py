from database import get_connection


from database import get_connection


def get_recommended_claims(categories, therapeutic_area):

    conn = get_connection()
    cur = conn.cursor()
    categories = [c.lower() for c in categories]

    query = """
    SELECT c.id, c.claim_text, c.citation, a.image_data
    FROM claims c
    LEFT JOIN claim_assets a
    ON c.id = a.claim_id
    WHERE LOWER(c.category) = ANY(%s::text[])
    AND LOWER(c.therapeutic_area) = LOWER(%s)
    LIMIT 20
    """

    cur.execute(query, (categories, therapeutic_area))

    rows = cur.fetchall()
    import base64

    claims = []


    for row in rows:

        image = None
        if row[3]:
            image = base64.b64encode(row[3]).decode()

        claims.append({
            "id": row[0],
            "claim_text": row[1],
            "citation": row[2],
            "image": image
        })

    cur.close()
    conn.close()

    return claims


def get_claims_by_ids(ids):

    conn = get_connection()
    cur = conn.cursor()

    query = """
    SELECT c.id, c.claim_text, c.citation, a.image_data
    FROM claims c
    LEFT JOIN claim_assets a
    ON c.id = a.claim_id
    WHERE c.id = ANY(%s)
    """

    cur.execute(query, (ids,))
    rows = cur.fetchall()
    import base64

    claims = []
    for row in rows:

        image = None
        if row[3]:
            image = base64.b64encode(row[3]).decode()

        claims.append({
            "id": row[0],
            "claim_text": row[1],
            "citation": row[2],
            "image": image
        })

    cur.close()
    conn.close()

    return claims