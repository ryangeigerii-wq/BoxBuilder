"""Quick developer diagnostics script.
Run: python dev_check.py
"""
from fastapi.routing import APIRoute
from main import app

if __name__ == "__main__":
    print("Registered routes:\n")
    for route in app.router.routes:
        if isinstance(route, APIRoute):
            methods = ",".join(route.methods)
            print(f"{methods:10} {route.path}")
