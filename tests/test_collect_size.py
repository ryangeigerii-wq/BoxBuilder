import pytest, time
from app.api.routes.subwoofers import _rank_subwoofers, Subwoofer

def _mk(rms, price):
    return Subwoofer(source='crutchfield', url=f'http://x/{rms}-{price}', brand='B', model='M', size_in=8.0,
                     rms_w=rms, peak_w=None, impedance_ohm=4.0, sensitivity_db=None, mounting_depth_in=None,
                     cutout_diameter_in=None, displacement_cuft=None, recommended_box='Sealed', price_usd=price,
                     image=None, scraped_at=time.time())

def test_rank_order():
    items = [_mk(400, 150), _mk(500, 120), _mk(500, 200), _mk(None, 300)]
    ranked = _rank_subwoofers(items)
    # Highest RMS=500 & highest price=200 first, then RMS=500 price=120, then 400, then None
    assert ranked[0].price_usd == 200
    assert ranked[0].rms_w == 500
    assert ranked[-1].rms_w is None
