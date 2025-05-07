const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app"); // Your Express app
let otp;
let token;
let email = "testuser2@gmail.com";

describe("User API", () => {
    // Test case for user signup
    it('POST /v1/user/sign_up should create a new user', async () => {
        const response = await request(app)
            .post('/v1/user/sign_up')
            .field('full_name', 'Test User')
            .field('email_address', email)
            .field('password', 'password123')
            .field('device_type', 'android')
            .field('device_token', '123465')
            .expect(200);

        expect(response.body).toHaveProperty('message', 'User signup successfully');
    });

    // Test case for user signup with missing fields
    it("POST /v1/user/sign_up should return 400 for missing fields", async () => {
        const response = await request(app).post("/v1/user/sign_up").expect(400);

        // Update the expectation to check for the message directly
        expect(response.body).toEqual({
            message: "Full name is required",
            statuscode: 0,
            success: false,
        });
    });

    // Test case for user login
    it("POST /v1/user/sign_in should log in a user", async () => {
        const response = await request(app)
            .post("/v1/user/sign_in")
            .field("email_address", email)
            .field("password", "password123")
            .field("device_type", "android")
            .field("device_token", "123465")
            .expect(200);

        token = response.body.data.token;

        expect(typeof response.body.data._id).toBe("string");
    });

    //   Test case for user login with incorrect credentials
    it('POST /v1/user/sign_in should return 401 for incorrect credentials', async () => {
        const response = await request(app)
            .post('/v1/user/sign_in')
            .field('email_address', 'wronguser@gmail.com')
            .field('password', 'wrongpassword')
            .field("device_type", "android")
            .field("device_token", "123465")
            .expect(400);

        expect(response.body).toEqual({ "message": "Account is not found, Please try again.", "statuscode": 0, "success": false });
    });

    // // Test case for getting user list
    it('POST /v1/user/user_list should return a list of users', async () => {
        const response = await request(app)
            .post('/v1/user/user_list')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(response.body).toHaveProperty('data');
    });

    // // Test case for editing user profile
    it('POST /v1/user/edit_profile should update user profile', async () => {
        const response = await request(app)
            .post('/v1/user/edit_profile')
            .set('Authorization', `Bearer ${token}`)
            .send({
                full_name: 'Updated User',
            })
            .expect(200);

        expect(typeof response.body.data._id).toBe("string");

    });

    // // Test case for forgetting password
    it('POST /v1/user/forget_password should send reset link', async () => {
        const response = await request(app)
            .post('/v1/user/forget_password')
            .field('email_address', email)
            .expect(200);

        otp = response.body.data.otp;

        expect(typeof response.body.data.otp).toBe("number");
    });

    // // Test case for verifying OTP
    it('POST /v1/user/verify_otp should verify the OTP', async () => {
        const response = await request(app)
            .post('/v1/user/verify_otp')
            .field('email_address', email)
            .field('otp', otp) // Replace with the actual OTP
            .expect(200);

        expect(response.body).toEqual({
            "success": true,
            "statuscode": 1,
            "message": "OTP verified successfully"
        });
    });

    // Test case for resetting password
    it('POST /v1/user/reset_password should reset the password', async () => {
        const response = await request(app)
            .post('/v1/user/reset_password')
            .field('email_address', email)
            .field('password', 'newpassword123')
            .expect(200);

        expect(response.body).toEqual({
            "success": true,
            "statuscode": 1,
            "message": "Password reset successfully"
        });
    });

    // // Test case for viewing user profile
    it('POST /v1/user/get_user_data should return user profile', async () => {

        const response = await request(app)
            .post('/v1/user/get_user_data')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(typeof response.body.data._id).toBe("string");
    });

    // // Test case for logging out user account
    // it('POST /v1/user/logout should delete the user account', async () => {
    //     const response = await request(app)
    //         .post('/v1/user/logout')
    //         .set('Authorization', `Bearer ${token}`)
    //         .expect(200);

    //     expect(response.body).toEqual({
    //         "success": true,
    //         "statuscode": 1,
    //         "message": "Your account is logout successfully",
    //         "data": []
    //     });
    // });

    //delete user account
     it('POST /v1/user/delete_account should delete the user account', async () => {
        const response = await request(app)
            .post('/v1/user/delete_account')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(response.body).toEqual({
            "success": true,
            "statuscode": 1,
            "message": "Your account is deleted successfully",
            "data": []
        });
    });


    afterAll(async () => {
        await mongoose.connection.close(); // Close the database connection
    });
});
