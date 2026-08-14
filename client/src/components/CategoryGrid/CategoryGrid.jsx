import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import "./CategoryGrid.css";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function CategoryGrid({ categories }) {
  return (
    <motion.div className="grid" variants={container} initial="hidden" animate="show">
      {categories.map((category) => {
        const [from, to] = category.gradient;
        return (
          <motion.div key={category.id} variants={item}>
            <Link to={`/category/${category.id}`}>
              <div className="category-card glass-card">
                <div
                  className="category-card__glow"
                  style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                />
                <span className="category-card__icon">{category.icon}</span>
                <span className="category-card__name">{category.name}</span>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
