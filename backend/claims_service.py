from database import get_connection


from database import get_connection


def get_recommended_claims(categories, therapeutic_area):

    conn = get_connection()
    cur = conn.cursor()
    categories = [c.lower() for c in categories]

    query = """
    SELECT id, claim_text, citation
    FROM claims
    WHERE LOWER(category) = ANY(%s::text[])
    AND LOWER(therapeutic_area) = LOWER(%s)
    LIMIT 10
    """

    cur.execute(query, (categories, therapeutic_area))

    rows = cur.fetchall()

    claims = []

    for row in rows:
        claims.append({
            "id": row[0],
            "claim_text": row[1],
            "citation": row[2]
        })

    cur.close()
    conn.close()

    return claims


def get_claims_by_ids(ids):

    conn = get_connection()
    cur = conn.cursor()

    query = """
    SELECT id, claim_text, citation
    FROM claims
    WHERE id = ANY(%s)
    """

    cur.execute(query, (ids,))
    rows = cur.fetchall()

    claims = []

    for row in rows:
        claims.append({
            "id": row[0],
            "claim_text": row[1],
            "citation": row[2]
        })

    cur.close()
    conn.close()

    return claims