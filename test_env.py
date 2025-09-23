#!/usr/bin/env python3
import os

print("=== Environment Variables Test ===")
print(f"PROJECT_ID: {os.environ.get('PROJECT_ID')}")
print(f"GOOGLE_CLOUD_PROJECT: {os.environ.get('GOOGLE_CLOUD_PROJECT')}")

# Firestore connection test
try:
    from google.cloud import firestore

    project_id = os.environ.get("PROJECT_ID") or os.environ.get("GOOGLE_CLOUD_PROJECT")

    if project_id:
        print(f"Attempting Firestore connection with project: {project_id}")
        db = firestore.Client(project=project_id, database="ai-future-diary-history")

        # Simple connection test
        docs = db.collection("diary_entries").limit(1).get()
        print(f"Firestore connection successful! Found {len(docs)} test documents")

        # Try to read actual data
        all_docs = db.collection("diary_entries").limit(10).get()
        print(f"Total documents in diary_entries: {len(all_docs)}")

        for doc in all_docs:
            data = doc.to_dict()
            print(f"Document ID: {doc.id}")
            print(f"  - userId: {data.get('userId')}")
            print(f"  - date: {data.get('date')}")
            print(f"  - planText: {bool(data.get('planText'))}")
            print(f"  - actualText: {bool(data.get('actualText'))}")

    else:
        print("No PROJECT_ID found in environment variables")

except Exception as e:
    print(f"Firestore connection failed: {e}")