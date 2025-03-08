import { Sequelize } from "sequelize";
import {
  host,
  port,
  user,
  password,
  database,
} from "./db.json";
let sequelize: Sequelize;
if(process.env.DEBUG){
  sequelize = new Sequelize("sqlite::memory:");
} else {
  sequelize = new Sequelize(database, user, password, {
    host: host,
    port: port,
    dialect: "mysql",
    logging: false
  });
  (async()=>{
      try {
        await sequelize.authenticate();
        console.log(new Date(), "Database connection has been established successfully.");
      } catch (error) {
        console.error(new Date(), "Unable to connect to the database:", error);
      }
  })();
}
export default sequelize;