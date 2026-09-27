## How to Craete Doctor

First Create User with 
  /register 
then update Role by 
  /updateRole/:user_id 
then end with 
  /register/doctor

---

# API Usage

## Health Check

GET /health

Check if the API server is running.

---

## Get All tables

GET /tables

Return All Exist Tables

---

## Get All User

GET /users

Return All User in the Database

---

## Get All Rows

GET /rows/:table

Example /rows/User
Return All Rows in the selected Table

---

## GET All Columns

GET /columns/User
Return All Columns in the selected Table

---

## Register User

POST /register

Request Body
{
  "username": "Donno",
  "password": "123",
  "confirm_password": "123"d
}


---

## Login

POST /login

Request Body
{
  "username": "Donno",
  "password": "123"
}

---

## Get User Info

GET /infoUser/:user_id

Example
/infoUser/1

---

## Update User

PUT /updateUser/:user_id

Example
/updateUser/1

Request Body
{
  "full_name": "Thanakrit",
  "phone": "012"
}

---

## Insert Pet

POST /insertPet/:user_id

Example
/insertPet/1

Request Body
{
    "pet_name":"Pn",
    "species":"Dog",
    "pet_breed":"uh",
    "bloodtype":"R",
    "birth_date":"2020/01/01",
    "pet_gender":"F",
    "weight":1,
    "allergy":"Food",
    "pet_image_url":""
}

---

## Get Pets (Home Page)

GET /getpets/:user_id

Example
/getpets/1

---

## Get Pet Info

GET /infopet/:pet_id

Example
/infopet/1

---

## Update Pet

PUT /updatePet/:pet_id

Example
/updatePet/1

Request Body
{
  "pet_name": "Pp",
  "species": "??",
  "bloodtype": "F",
  "birth_date": "1000-08-21",
  "weight": "99",
  "allergy": "uhh"
}

---

## Insert Appointment

POST /insertAppointment/:pet_id/:user_id/:doc_id

Example /insertAppointment/1/1/1
Request Body
{
    "app_date":"2026-03-11",
    "app_time":"10:35:00",
    "reason":"ขาหัก"
}

---

## Get ALL pet from User ID

GET /getpets/:user_id

Example /getpets/1

---

## Get pet Infomation

GET /infopet/:pet_id

Example /infopet/1

---

## Update Pet infomation

PUT /updatePet/:pet_id

Example /updatePet/1
Request Body
{
  "pet_name": "Pp",
  "species": "??",
  "bloodtype": "F",
  "birth_date": "1000-08-21",
  "weight": "99",
  "allergy": "uhh"
}

---

## Delete Pet

DELETE /deletePet/:pet_id

Example /deletePet/1

---

## Insert Medical Record

POST /insertMedRecord/:pet_id/:doc_id/:app_id

Example /insertMedRecord/1/1/1
Request Body
{
    "diagnosis":"ขาหัก",
    "cost":10,
    "treatment_detail":"เอาพาราไปกิน เด๊๋ยวก็หาย",
    "treatment_date":"2026-03-11",
    "treatment_time":"10:35:00"
}

---

## Update Medical Record

PUT /updateMedRecord/:record_id

Example /updateMedRecord/1
Request Body
{
    "diagnosis":"ขาหัก",
    "cost":10,
    "treatment_detail":"เอาพาราไปกิน เด๊๋ยวก็หาย",
    "treatment_date":"2026-03-11",
    "treatment_time":"10:35:00"
}

---

## Get Medical Record from Pet ID

GET /getMedicalRecord/:pet_id

Example /getMedicalRecord/1

---

## Get Medical Info Record

GET /getMedicalRecordInfo/:record_id

Example /getMedicalRecordInfo/1

---

## Get Medical Record from Doc ID

GET /getMedicalRecordsByDoctor/:doc_id

Example /getMedicalRecordsByDoctor/1

---

## Insert Appointment

POST /insertAppointment/:pet_id/:user_id/:doc_id

Example /insertAppointment/1/1/1
Request Body
{
  "app_date":"2020/01/01",
  "app_time":"10:35:00",
  "reason":"why"
}

---

## Get Appointment List for User

GET /getUserAppointmentslist/:user_id

Example /getUserAppointmentslist/1

---

## Delete Appointment

DELETE /deleteAppointment/:app_id

Example /deleteAppointment/1

---

## Get Appointment List for Doctor

GET /getDoctorAppointmentslist/:doc_id

Example /getDoctorAppointmentslist/1

---

## Update Appointment Status

PUT /updateAppointmentStatus/:app_id

Example /updateAppointmentStatus/1
Request Body
{
  "status":"Approval"
}

---

## Get Doctor List

GET /getDoctors

Example /getDoctors

---

## Change Role

PUT /updateRole/:user_id

Example /updateRole/1

---

## Register Doctor

POST /registerdoctor/:user_id

Example /registerdoctor/1
Request Body
{
    "specialization":"toe",
    "work_time":"24/6"
}

---

## Update Doctor Info

PUT /updateDoctorinfo/:doc_id

Example /updateDoctorinfo/1
Request Body
{
  "specialization":"Toe",
  "work_time":"24/7"
}

---

## UpdateAvailableDoctor

PUT /updateAvailableDoctor/:doc_id

Example /updateAvailableDoctor/1
Request Body
{
  "is_available":"No"
}

---