from database import get_connection


def create_project(content_type, audience, goal, tone, therapeutic_area):

    conn = get_connection()
    cur = conn.cursor()

    query = """
    INSERT INTO content_projects (
        content_type, audience, goal, tone, therapeutic_area
    )
    VALUES (%s, %s, %s, %s, %s)
    RETURNING id
    """

    cur.execute(query, (content_type, audience, goal, tone, therapeutic_area))

    project_id = cur.fetchone()[0]

    conn.commit()

    cur.close()
    conn.close()

    return project_id


def store_version(project_id, version_number, content_text, html_output):

    conn = get_connection()
    cur = conn.cursor()

    query = """
    INSERT INTO content_versions (
        project_id, version_number, content_text, html_output
    )
    VALUES (%s, %s, %s, %s)
    """

    cur.execute(query, (project_id, version_number, content_text, html_output))

    conn.commit()

    cur.close()
    conn.close()