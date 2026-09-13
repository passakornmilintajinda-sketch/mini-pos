'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function SellPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // ดึงรายการสินค้าทั้งหมดมาใส่ dropdown
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

  // หาสินค้าที่เลือกอยู่จาก id
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // คำนวณยอดรวม = ราคา x จำนวน
  const totalPrice =
    selectedProduct && quantity
      ? Number(selectedProduct.price) * Number(quantity)
      : 0;

  const resetForm = () => {
    setSelectedProductId('');
    setQuantity('');
  };

  const handleSell = async (e) => {
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

    setSubmitting(true);

    // ดึงข้อมูล stock ล่าสุดของสินค้าอีกครั้ง เพื่อป้องกันข้อมูลเก่าค้างจากตอนโหลดหน้า
    const { data: currentProduct, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', selectedProductId)
      .single();

    if (fetchError || !currentProduct) {
      alert('ไม่พบข้อมูลสินค้า กรุณาลองใหม่');
      setSubmitting(false);
      return;
    }

    // ตรวจสอบว่า stock เพียงพอหรือไม่
    if (currentProduct.stock < qty) {
      alert(`สินค้าคงเหลือไม่พอ (คงเหลือ ${currentProduct.stock} ${currentProduct.unit})`);
      setSubmitting(false);
      return;
    }

    const total = Number(currentProduct.price) * qty;

    // บันทึกรายการขายลงตาราง sales
    const { error: insertError } = await supabase.from('sales').insert([
      {
        product_id: currentProduct.id,
        product_name: currentProduct.name,
        quantity: qty,
        total_price: total,
        sold_at: new Date().toISOString(),
      },
    ]);

    if (insertError) {
      alert('บันทึกการขายไม่สำเร็จ: ' + insertError.message);
      setSubmitting(false);
      return;
    }

    // อัปเดต stock ในตาราง products ให้ลดลง
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: currentProduct.stock - qty })
      .eq('id', currentProduct.id);

    if (updateError) {
      alert('อัปเดตสต็อกไม่สำเร็จ: ' + updateError.message);
      setSubmitting(false);
      return;
    }

    // สำเร็จ: แจ้งเตือน รีเซ็ตฟอร์ม และโหลดสินค้าใหม่ (เพื่ออัปเดต stock ใน dropdown)
    setSuccessMessage(
      `ขายสำเร็จ: ${currentProduct.name} x${qty} รวม ${total.toFixed(2)} บาท`
    );
    resetForm();
    fetchProducts();
    setSubmitting(false);
  };

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {loading && <p>กำลังโหลดข้อมูลสินค้า...</p>}
      {error && <p style={{ color: 'red' }}>เกิดข้อผิดพลาด: {error}</p>}

      {!loading && !error && (
        <div className="card" style={{ maxWidth: '480px' }}>
          <form onSubmit={handleSell}>
            {/* Dropdown เลือกสินค้า */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.3rem' }}>
                เลือกสินค้า
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">-- เลือกสินค้า --</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — {Number(product.price).toFixed(2)} บาท (คงเหลือ {product.stock})
                  </option>
                ))}
              </select>
            </div>

            {/* ช่องกรอกจำนวน */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.3rem' }}>
                จำนวน
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            {/* แสดงยอดรวมอัตโนมัติ */}
            <div style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>
              ยอดรวม: <strong>{totalPrice.toFixed(2)} บาท</strong>
            </div>

            <button type="submit" disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : 'ขาย'}
            </button>
          </form>

          {successMessage && (
            <p style={{ color: 'green', marginTop: '1rem' }}>{successMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}
