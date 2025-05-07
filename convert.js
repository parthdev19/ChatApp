import swaggerAutogen from "swagger-autogen";

// Swagger documentation configuration
const doc = {
  info: {
    title: "Converted API",
    description: "API documentation converted from Postman",
    version: "1.0.0",
  },
  host: "localhost:3000",
  basePath: "/",
  schemes: ["http"],
};

const outputFile = "./postman_to_swagger.json"; // Output file path
const endpointsFiles = ["Chat_demo.postman_collection.json"]; // Input Postman JSON file

// Generate Swagger JSON documentation
swaggerAutogen()(outputFile, endpointsFiles, doc)
  .then(() => {
    console.log("Swagger JSON generated successfully!");
  })
  .catch((error) => {
    console.error("Error generating Swagger JSON:", error);
  });
