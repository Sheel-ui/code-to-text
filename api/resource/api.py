from flask import request
from flask_restful import Resource
from src.generator import Generator
import traceback
import sys
import json

gen = Generator()

class CodeToText(Resource):

    def get(self):
        return {
            "status": "success",
            "message": "Service is running"
            }

    def post(self):
        try:
            data = json.loads(request.data)
            code = data['code']
            lang = data['lang']
            comment = gen.generate(code,lang)
            return {
                'status':"success",
                'comment': comment
            }
        except Exception as e:
            return { "error": "Something went wrong: {} {}".format(type(e).__name__,e) }