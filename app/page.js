'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ฟอร์มเพิ่มสินค้าใหม่
  const [form, setForm] = useState({
    sku: '',
    name: '',
    price: '',
    stock: '',
    unit: '',
  });

  // state สำหรับแก้ไขแบบ inline (เก็บ id แถวที่กำลังแก้ และข้อมูลที่แก้)
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // ดึงรายการสินค้าทั้งหมดจาก Supabase
  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

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

  // เพิ่มสินค้าใหม่
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!form.sku || !form.name || !form.price) {
      alert('กรุณากรอก SKU, ชื่อสินค้า และราคาให้ครบ');
      return;
    }

    const { error } = await supabase.from('products').insert([
      {
        sku: form.sku,
        name: form.name,
        price: parseFloat(form.price),
        stock: parseInt(form.stock, 10) || 0,
        unit: form.unit,
      },
    ]);

    if (error) {
      alert('เพิ่มสินค้าไม่สำเร็จ: ' + error.message);
      return;
    }

    // เคลียร์ฟอร์มและโหลดข้อมูลใหม่
    setForm({ sku: '', name: '', price: '', stock: '', unit: '' });
    fetchProducts();
  };

  // ลบสินค้า
  const handleDelete = async (id) => {
    if (!confirm('ยืนยันการลบสินค้านี้?')) return;

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      alert('ลบไม่สำเร็จ: ' + error.message);
      return;
    }
    fetchProducts();
  };

  // เริ่มแก้ไขแถว (เก็บข้อมูลเดิมไว้ใน editForm)
  const startEdit = (product) => {
    setEditingId(product.id);
    setEditForm({
      sku: product.sku,
      name: product.name,
      price: product.price,
      stock: product.stock,
      unit: product.unit,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  // บันทึกการแก้ไข
  const handleSaveEdit = async (id) => {
    const { error } = await supabase
      .from('products')
      .update({
        sku: editForm.sku,
        name: editForm.name,
        price: parseFloat(editForm.price),
        stock: parseInt(editForm.stock, 10) || 0,
        unit: editForm.unit,
      })
      .eq('id', id);

    if (error) {
      alert('บันทึกไม่สำเร็จ: ' + error.message);
      return;
    }

    setEditingId(null);
    setEditForm({});
    fetchProducts();
  };

  return (
    <div>
      <h1>รายการสินค้า</h1>

      {/* ฟอร์มเพิ่มสินค้าใหม่ */}
      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>เพิ่มสินค้าใหม่</h2>
        <form
          onSubmit={handleAddProduct}
          style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}
        >
          <input
            type="text"
            placeholder="SKU"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            style={{ width: '120px' }}
          />
          <input
            type="text"
            placeholder="ชื่อสินค้า"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={{ width: '180px' }}
          />
          <input
            type="number"
            placeholder="ราคา"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            style={{ width: '100px' }}
            step="0.01"
          />
          <input
            type="number"
            placeholder="คงเหลือ"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
            style={{ width: '100px' }}
          />
          <input
            type="text"
            placeholder="หน่วย เช่น ชิ้น, ขวด"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            style={{ width: '120px' }}
          />
          <button type="submit">+ เพิ่มสินค้า</button>
        </form>
      </div>

      {/* แสดงสถานะ / error */}
      {loading && <p>กำลังโหลดข้อมูล...</p>}
      {error && <p style={{ color: 'red' }}>เกิดข้อผิดพลาด: {error}</p>}

      {/* ตารางสินค้า */}
      {!loading && !error && (
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>ชื่อสินค้า</th>
              <th>ราคา</th>
              <th>คงเหลือ</th>
              <th>หน่วย</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={6}>ยังไม่มีสินค้า</td>
              </tr>
            )}
            {products.map((product) => (
              <tr key={product.id}>
                {editingId === product.id ? (
                  // โหมดแก้ไข inline
                  <>
                    <td>
                      <input
                        type="text"
                        value={editForm.sku}
                        onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                        style={{ width: '90px' }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        style={{ width: '140px' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={editForm.price}
                        onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                        style={{ width: '80px' }}
                        step="0.01"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={editForm.stock}
                        onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                        style={{ width: '70px' }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={editForm.unit}
                        onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                        style={{ width: '80px' }}
                      />
                    </td>
                    <td style={{ display: 'flex', gap: '0.4rem' }}>
                      <button onClick={() => handleSaveEdit(product.id)}>บันทึก</button>
                      <button
                        onClick={cancelEdit}
                        style={{ backgroundColor: '#999' }}
                      >
                        ยกเลิก
                      </button>
                    </td>
                  </>
                ) : (
                  // โหมดแสดงผลปกติ
                  <>
                    <td>{product.sku}</td>
                    <td>{product.name}</td>
                    <td>{Number(product.price).toFixed(2)}</td>
                    <td>{product.stock}</td>
                    <td>{product.unit}</td>
                    <td style={{ display: 'flex', gap: '0.4rem' }}>
                      <button onClick={() => startEdit(product)}>แก้ไข</button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        style={{ backgroundColor: '#e00' }}
                      >
                        ลบ
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
