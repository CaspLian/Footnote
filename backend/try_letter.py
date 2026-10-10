"""Test the full flow on one bill: analyze it, then draft a letter.

    python try_letter.py samples/test_bills/1_er_itemized_bill.pdf --lang es

Needs the server running (uvicorn main:app --reload).
"""
import argparse
import json
import mimetypes
import urllib.request
import uuid

API = "http://localhost:8000"


def post_file(path, lang):
    boundary = uuid.uuid4().hex
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    with open(path, "rb") as f:
        data = f.read()
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"target_language\"\r\n\r\n{lang}\r\n"
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{path.split('/')[-1]}\"\r\n"
        f"Content-Type: {mime}\r\n\r\n"
    ).encode() + data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(f"{API}/api/v1/analyze", data=body,
                                 headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    return json.load(urllib.request.urlopen(req, timeout=200))


def post_json(path, payload):
    req = urllib.request.Request(f"{API}{path}", data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=200))


p = argparse.ArgumentParser()
p.add_argument("file")
p.add_argument("--lang", default="en")
a = p.parse_args()

print("Analyzing...")
analysis = post_file(a.file, a.lang)
print("letter_suggested:", analysis["letter_suggested"], analysis["letter_reasons"])
if not analysis["letter_suggested"]:
    print("Nothing to dispute on this bill, so the app would not show the letter button.")
else:
    print("Drafting letter...")
    letter = post_json("/api/v1/letter", {"analysis": analysis, "patient_name": "Test Patient",
                                          "patient_address": "123 Example St, Bronx, NY 10461"})
    print("\nTO:", letter["recipient"])
    print("SUBJECT:", letter["subject"])
    print("\n" + letter["body"])
    print("\nStill to fill in:", letter["placeholders"])
    print("\nExplanation:", letter["explanation"])
    print("Next steps:"); [print("  -", s) for s in letter["next_steps"]]
