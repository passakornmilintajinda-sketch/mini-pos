'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

const LOW_STOCK_THRESHOLD = 5;

export default function SellPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [cart, setCart] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setProducts(data);
      setError('');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // ยิงแจ้งเตือนผ่าน API Route ของเราเอง (ไม่ยิง Telegram ตรงจาก browser)
  // ทำงานแบบ try-catch เสมอ เพื่อไม่ให้ error กระทบขั้นตอนขาย
  const sendTelegramNotification = async (text) => {
    try {
      await fetch('/api/telegram-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    } catch (err) {
      // เงียบไว้ ไม่ต้องแจ้งผู้ใช้ เพราะไม่ใช่ error ที่กระทบการขาย
      console.error('ส่ง Telegram แจ้งเตือนไม่สำเร็จ:', err);
    }
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    setSuccessMessage('');

    if (!selectedProductId) {
      alert('กรุณาเลือกสินค้า');
      return;
    }
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
      alert('กรุณากรอกจำนวนให้ถูกต้อง');
      return;
    }

    const existingInCart = cart.find((item) => item.product_id === selectedProductId);
    const qtyAlreadyInCart = existingInCart ? existingInCart.quantity : 0;

    if (qtyAlreadyInCart + qty > selectedProduct.stock) {
      alert(`สินค้าคงเหลือไม่พอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit})`);
      return;
    }

    if (existingInCart) {
      setCart(
        cart.map((item) =>
          item.product_id === selectedProductId
            ? { ...item, quantity: item.quantity + qty }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          product_id: selectedProduct.id,
          name: selectedProduct.name,
          price: Number(selectedProduct.price),
          unit: selectedProduct.unit,
          quantity: qty,
        },
      ]);
    }

    setSelectedProductId('');
    setQuantity('');
  };

  const handleRemoveFromCart = (productId) => {
    setCart(cart.filter((item) => item.product_id !== productId));
  };

  const handleChangeCartQty = (productId, newQty) => {
    const qty = parseInt(newQty, 10);
    setCart(
      cart.map((item) =>
        item.product_id === productId
          ? { ...item, quantity: qty > 0 ? qty : 1 }
          : item
      )
    );
  };

  const grandTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const resetCart = () => {
    setCart([]);
    setSelectedProductId('');
    setQuantity('');
  };

  const handleCheckout = async () => {
    setSuccessMessage('');

    if (cart.length === 0) {
      alert('กรุณาเพิ่มสินค้าลงตะกร้าก่อน');
      return;
    }

    setSubmitting(true);

    const productIds = cart.map((item) => item.product_id);
    const { data: currentProducts, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);

    if (fetchError || !currentProducts) {
      alert('ไม่สามารถตรวจสอบสต็อกสินค้าได้ กรุณาลองใหม่');
      setSubmitting(false);
      return;
    }

    for (const item of cart) {
      const current = currentProducts.find((p) => p.id === item.product_id);
      if (!current || current.stock < item.quantity) {
        alert(
          `สินค้า "${item.name}" คงเหลือไม่พอ (คงเหลือ ${current ? current.stock : 0} ${item.unit})`
        );
        setSubmitting(false);
        return;
      }
    }

    const soldAt = new Date().toISOString();
    const salesRows = cart.map((item) => ({
      product_id: item.product_id,
      product_name: item.name,
      quantity: item.quantity,
      total_price: item.price * item.quantity,
      sold_at: soldAt,
    }));

    const { error: insertError } = await supabase.from('sales').insert(salesRows);

    if (insertError) {
      alert('บันทึกการขายไม่สำเร็จ: ' + insertError.message);
      setSubmitting(false);
      return;
    }

    // อัปเดต stock ทีละรายการ พร้อมยิง Telegram แจ้งเตือนหลังตัดสต็อกสำเร็จแต่ละชิ้น
    for (const item of cart) {
      const current = currentProducts.find((p) => p.id === item.product_id);
      const stockAfter = current.stock - item.quantity;

      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: stockAfter })
        .eq('id', item.product_id);

      if (updateError) {
        alert(`อัปเดตสต็อกของ "${item.name}" ไม่สำเร็จ: ${updateError.message}`);
        setSubmitting(false);
        fetchProducts();
        return;
      }

      const itemTotal = item.price * item.quantity;
      const timeStr = new Date().toLocaleString('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      // งานที่ 1: แจ้งเตือน Order ใหม่
      const orderMessage =
        `🛍️ <b>มีรายการขายใหม่!</b>\n` +
        `- สินค้า: ${item.name}\n` +
        `- จำนวน: ${item.quantity} ชิ้น\n` +
        `- ราคารวม: ${itemTotal.toFixed(2)} บาท\n` +
        `- สต๊อกคงเหลือปัจจุบัน: ${stockAfter} ชิ้น\n` +
        `- เวลา: ${timeStr}`;

      await sendTelegramNotification(orderMessage);

      // งานที่ 2: แจ้งเตือน Stock เหลือน้อย (ถ้าเข้าเงื่อนไข)
      if (stockAfter <= LOW_STOCK_THRESHOLD) {
        const lowStockMessage =
          `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>\n` +
          `- สินค้า: ${item.name}\n` +
          `- คงเหลือเพียง: ${stockAfter} ชิ้น\n` +
          `⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`;

        await sendTelegramNotification(lowStockMessage);
      }
    }

    setSuccessMessage(`ขายสำเร็จ! ยอดรวม ${grandTotal.toFixed(2)} บาท`);
    resetCart();
    fetchProducts();
    setSubmitting(false);
  };

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {loading && <p>กำลังโหลดข้อมูลสินค้า...</p>}
      {error && <p style={{ color: 'red' }}>เกิดข้อผิดพลาด: {error}</p>}

      {!loading && !error && (
        <>
          <div
            className="card"
            style={{ textAlign: 'center', backgroundColor: '#0070f3', color: '#fff' }}
          >
            <div style={{ fontSize: '1rem', opacity: 0.85 }}>ยอดรวมทั้งหมด</div>
            <div style={{ fontSize: '2.8rem', fontWeight: 800, lineHeight: 1.2 }}>
              {grandTotal.toFixed(2)} บาท
            </div>
            <div style={{ fontSize: '0.9rem', opacity: 0.85 }}>
              {cart.length} รายการสินค้า
            </div>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>เพิ่มสินค้าลงตะกร้า</h2>
            <form
              onSubmit={handleAddToCart}
              style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}
            >
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                style={{ flex: '1 1 220px' }}
              >
                <option value="">-- เลือกสินค้า --</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — {Number(product.price).toFixed(2)} บาท (คงเหลือ {product.stock})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                placeholder="จำนวน"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                style={{ width: '100px' }}
              />
              <button type="submit">+ เพิ่มลงตะกร้า</button>
            </form>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>รายการในตะกร้า</h2>
            {cart.length === 0 ? (
              <p style={{ color: '#888' }}>ยังไม่มีสินค้าในตะกร้า</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>สินค้า</th>
                    <th>ราคา/หน่วย</th>
                    <th>จำนวน</th>
                    <th>รวม</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.product_id}>
                      <td>{item.name}</td>
                      <td>{item.price.toFixed(2)}</td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleChangeCartQty(item.product_id, e.target.value)}
                          style={{ width: '70px' }}
                        />
                      </td>
                      <td>{(item.price * item.quantity).toFixed(2)}</td>
                      <td>
                        <button
                          onClick={() => handleRemoveFromCart(item.product_id)}
                          style={{ backgroundColor: '#e00' }}
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <button
            onClick={handleCheckout}
            disabled={submitting || cart.length === 0}
            style={{ width: '100%', fontSize: '1.2rem', padding: '0.9rem', fontWeight: 700 }}
          >
            {submitting ? 'กำลังบันทึก...' : `ยืนยันการขาย (${grandTotal.toFixed(2)} บาท)`}
          </button>

          {successMessage && (
            <p style={{ color: 'green', marginTop: '1rem', fontSize: '1.05rem' }}>
              {successMessage}
            </p>
          )}
        </>
      )}
    </div>
  );
}
