import { Link } from '../Link';
import { Layout } from './Layout';

export function NotFound() {
  return (
    <Layout title="Page not found · NEXA Forge">
      <section className="wrap page-head">
        <h1>Page not found</h1>
        <p className="lede">There is nothing at this address.</p>
        <p className="cta-row">
          <Link href="/" className="btn btn-primary btn-lg">
            Go to the homepage
          </Link>
          <Link href="/docs" className="btn btn-lg">
            Read the docs
          </Link>
        </p>
      </section>
    </Layout>
  );
}
