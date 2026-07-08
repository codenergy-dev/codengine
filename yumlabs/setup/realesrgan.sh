python3 -m venv realesrgan

source realesrgan/bin/activate

pip install git+https://github.com/sberbank-ai/Real-ESRGAN.git

pip uninstall numpy
pip install "numpy<2.0"

pip uninstall torchvision
pip uninstall torch
pip install "torch<2.0"
pip install "torchvision==0.14.1"

pip uninstall huggingface_hub
pip install "huggingface_hub==0.25.2"