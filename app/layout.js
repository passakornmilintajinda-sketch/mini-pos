import './globals.css';

export const metadata = {
  title: 'Mini POS',
  description: 'ระบบขายของร้านเล็ก',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>
        <header className="navbar">
          <div className="navbar-inner">
            <span className="brand">Mini POS</span>
            <nav className="nav-links">
              <a href="/">สินค้า</a>
              <a href="/sell">ขายสินค้า</a>
              <a href="/history">ประวัติการขาย</a>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
