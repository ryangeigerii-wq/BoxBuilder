from app.scraping.parser import parse_subwoofers

SAMPLE_HTML = """
<html>
  <body>
    <div class="product-card">
      <span class="product-title">ThunderBoom 12" Subwoofer</span>
      <div class="price">$199.99</div>
    </div>
    <div class="product-card">
      <span class="product-title">MegaBass 10" Subwoofer</span>
      <div class="price">$149.50</div>
    </div>
  </body>
</html>
"""


def test_parse_subwoofers_multiple_cards():
    items = parse_subwoofers(SAMPLE_HTML, source="test")
    assert len(items) == 2
    assert items[0].name.startswith("ThunderBoom")
    assert items[0].price == 199.99
    assert items[1].price == 149.50
