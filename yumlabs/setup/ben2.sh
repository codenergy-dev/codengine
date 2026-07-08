python3 -m venv ben2

source ben2/bin/activate

pip install -e "git+https://github.com/PramaLLC/BEN2.git#egg=ben2"

pip uninstall numpy
pip install "numpy<2.0"

pip install opencv-python