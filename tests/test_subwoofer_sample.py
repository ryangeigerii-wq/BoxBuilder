from app.api.routes.subwoofers import sample_subwoofers, save_db, Subwoofer
import pytest, time

@pytest.mark.asyncio
async def test_sample_empty_db(monkeypatch, tmp_path):
    # Ensure DB path points to temp
    from app.api.routes import subwoofers as mod
    mod.DB_PATH = tmp_path / 'subwoofers.json'
    # Force crawl to return deterministic fake list without network
    async def fake_crawl(pages: int = 1):
        return [Subwoofer(source='crutchfield', url='http://x', brand='Brand', model='Model', size_in=12.0,
                          rms_w=500, peak_w=None, impedance_ohm=4.0, sensitivity_db=None, mounting_depth_in=None,
                          cutout_diameter_in=None, displacement_cuft=None, recommended_box='Ported', price_usd=199.99,
                          image=None, scraped_at=time.time())]
    monkeypatch.setattr(mod, 'crawl_crutchfield', fake_crawl)
    result = await sample_subwoofers(limit=1)
    assert result['returned'] == 1
    assert result['total'] == 1
    assert result['items'][0]['brand'] == 'Brand'

@pytest.mark.asyncio
async def test_sample_limit(monkeypatch, tmp_path):
    from app.api.routes import subwoofers as mod
    mod.DB_PATH = tmp_path / 'subwoofers.json'
    items = []
    now = time.time()
    for i in range(10):
        items.append(Subwoofer(source='crutchfield', url=f'http://x/{i}', brand='B', model=f'M{i}', size_in=10.0,
                               rms_w=300, peak_w=None, impedance_ohm=4.0, sensitivity_db=None, mounting_depth_in=None,
                               cutout_diameter_in=None, displacement_cuft=None, recommended_box='Sealed', price_usd=99.0,
                               image=None, scraped_at=now))
    save_db(items)
    result = await sample_subwoofers(limit=3)
    assert result['returned'] == 3
    assert len(result['items']) == 3
