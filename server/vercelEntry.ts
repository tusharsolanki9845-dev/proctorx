import serverless from "serverless-http";
import { createServerApp } from "./serverApp";

export default serverless(createServerApp());
