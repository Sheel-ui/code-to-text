import unittest
import json
import requests
from dotenv import load_dotenv
import os

load_dotenv()

class APITest(unittest.TestCase):
    API_URL = "http://{host}:{port}{endpoint}".format(host=os.getenv('HOST'),port=os.getenv('PORT'),endpoint=os.getenv('ENDPOINT'))

    def test_python(self):
        r = requests.request("GET", APITest.API_URL)
        self.assertEqual(r.status_code,200)
        self.assertEqual(r.json()['status'],"success")

if __name__ == '__main__':
    unittest.main()