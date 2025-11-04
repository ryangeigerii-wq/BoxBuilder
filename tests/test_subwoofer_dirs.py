import os
from importlib import reload

def test_subwoofer_dirs_created():
    # Import main to trigger get_application which calls ensure_subwoofer_dirs
    import main
    reload(main)
    root = 'subwoofers'
    sizes = ['8','10','12','15','18']
    for s in sizes:
        path = os.path.join(root, s)
        assert os.path.isdir(path), f"missing directory {path}"