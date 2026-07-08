python3 -m venv venv

source venv/bin/activate

pip install torch

pip install -U controlnet-aux

pip uninstall numpy
pip install "numpy<2.0"

pip install diffusers
pip install accelerate
pip install transformers
pip install peft

pip install mediapipe