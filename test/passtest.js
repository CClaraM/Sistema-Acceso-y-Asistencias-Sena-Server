import bcrypt from "bcryptjs";
const hash = await bcrypt.hash("LauraDiaz", 10);
console.log("Hashed password:", hash);