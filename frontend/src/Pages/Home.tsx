
import { authClient } from "../auth-client";

function Home() {
  const { data: session } = authClient.useSession();

  const name = session?.user?.name?.trim().split(/\s+/)[0] || "there";

  return (
    <div className="home-page">
      <section className="home-welcome">
        <p className="home-eyebrow">WELCOME TO KONTRACK</p>
        <h1>Hello, {name}!</h1>
        <p className="home-subtitle">
          
        </p>
      </section>
    </div>
  );
}

export default Home;
