import { Button } from "../ui/Button";
import CiteMeInLogo from "./CiteMeInLogo";

export default function LandingPageNav({
  isSignedIn,
}: {
  isSignedIn: boolean;
}) {
  return (
    <nav className="flex items-center justify-between border-b-2 border-black bg-[hsl(60,100%,99%)] px-6 py-3">
      <CiteMeInLogo />
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <Button variant="default" as="a" href="/sites">
              Dashboard
            </Button>
          ) : (
            <>
              <Button variant="default" as="a" href="/sign-in">
                Sign in
              </Button>
              <Button variant="default" as="a" href="/sign-up">
                Get started
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
