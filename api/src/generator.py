import os
from dotenv import load_dotenv, find_dotenv
from transformers import SummarizationPipeline, AutoTokenizer, AutoModelWithLMHead
from tree_sitter import Language, Parser


def code_to_str(node, lines,code_list):
    # Converts a specific code node into a string representation and appends it to a list of code strings.
    start_line = node.start_point[0]
    end_line = node.end_point[0]
    start_char = node.start_point[1]
    end_char = node.end_point[1]
    if start_line != end_line:
        code_list.append(' '.join([lines[start_line][start_char:]] + lines[start_line+1:end_line] + [lines[end_line][:end_char]]))
    else:
        code_list.append(lines[start_line][start_char:end_char])
    return code_list

def get_tokenized_code(node, code, code_list):
    # Retrieves the tokenized code representation recursively from a given node and returns it as a string
    lines = code.split('\n')
    if node.child_count == 0:
        code_list = code_to_str(node, lines,code_list)
    elif node.type == 'string':
        code_list = code_to_str(node, lines, code_list)
    else:
        for child_node in node.children:
            get_tokenized_code(child_node,code, code_list)
 
    return ' '.join(code_list)

class Generator:

    def __init__(self, model_path = None):
        load_dotenv(find_dotenv())
        languages = os.getenv('LANGUAGES').split(',')
        models = os.getenv('MODELS').split(',')
        MODEL_LIST = {}
        for model in languages:
            MODEL_LIST[model]=os.getenv(model.upper())

        self.pipeline = {}
        self.parsers={}
        self.LANGUAGE={}

        # loading tree-sitter parsers and model
        for model in models:
            if model in languages:
                self.parsers[model] = Parser()
                self.parsers[model].set_language(Language('build/language.so', model))
                self.pipeline[model] = SummarizationPipeline(
                    model=AutoModelWithLMHead.from_pretrained(MODEL_LIST[model]),
                    tokenizer=AutoTokenizer.from_pretrained(MODEL_LIST[model]))


    def generate(self, code, lang):
        # generating comment
        try:
            tree = self.parsers[lang].parse(bytes(code, "utf8"))
            code_list=[]
            tokenized_code = get_tokenized_code(tree.root_node,code, code_list)
            return self.pipeline[lang]([tokenized_code])[0]['summary_text']
        except:
            raise
