import os
from flask import Flask
from flask_restful import Api
from resource.api import *
from dotenv import load_dotenv

app = Flask(__name__)
api = Api(app)
load_dotenv()

api.add_resource(CodeToText, os.getenv('ENDPOINT'))

if __name__ == '__main__':
   app.run(port=os.getenv('PORT'),host=os.getenv('HOST'),debug=True)