import { ArrowRight, ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { twMerge } from "tailwind-merge";
import type { BlogPost } from "~/lib/blogPosts.server";
import { formatDateMed } from "~/lib/temporal";
import { ActiveLink } from "./ActiveLink";
import LoadingImage from "./LoadingImage";

export default function BlogPostsGrid({
  className,
  posts,
  limit,
}: {
  className?: string;
  posts: BlogPost[];
  limit?: number;
}) {
  return (
    <section
      className={`blog-posts px-4 py-20${className ? ` ${className}` : ""}`}
    >
      <div className="container mx-auto max-w-7xl">
        {posts.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-medium text-black text-xl">
              No blog posts published yet. Check back soon!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {posts.slice(0, limit).map((post) => (
              <BlogPostCard key={post.slug} post={post} />
            ))}
            {limit && posts.length > limit && (
              <ActiveLink
                to="/blog"
                variant="highlight"
                className="col-span-full text-center text-2xl"
              >
                Explore all blog posts <ArrowRight strokeWidth={4} />
              </ActiveLink>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function BlogPostCard({ post }: { post: BlogPost }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className={twMerge(
        "flex flex-col overflow-hidden rounded-md border-2 border-black bg-white shadow-[4px_4px_0px_0px_black]",
        "transform transition-all duration-200 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:rotate-1 hover:shadow-[6px_6px_0px_0px_black]",
      )}
    >
      <LoadingImage
        alt={post.alt}
        figureClassName="border-b-2 border-black"
        maxHeight={200}
        src={`/blog/${post.image}`}
      />
      <div className="flex h-60 flex-col justify-between gap-3 p-6">
        <div>
          <time
            dateTime={post.published.toISOString()}
            className="text-gray-500 text-sm"
          >
            {formatDateMed(post.published)}
          </time>
          <h2 className="line-clamp-2 font-bold text-black text-xl">
            {post.title}
          </h2>
        </div>
        <p className="line-clamp-3 font-medium text-base text-black">
          {post.summary}
        </p>
        <div className="flex items-center gap-2 font-bold text-[#F59E0B] text-sm">
          <span>Read more</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}
