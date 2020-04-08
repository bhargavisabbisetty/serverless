const aws = require("aws-sdk");
var ddb = new aws.DynamoDB({ apiVersion: "2012-08-10" });
var ses = new aws.SES();
aws.config.update({ region: "us-east-1" });
var docClient = new aws.DynamoDB.DocumentClient();
exports.emailService = function (event, context, callback) {
    let message = event.Records[0].Sns.Message;
    let messageJson = JSON.parse(message);
    let data = JSON.parse(messageJson.data);
    console.log("Test Message: " + messageJson.data);
    console.log("Test Email: " + data.Email);
    console.log("Test due count: " + data.count)
    let currentTime = new Date().getTime();
    let ttl = 60 * 60 * 1000;
    let expirationTime = (currentTime + ttl).toString();
    var billsData = ""
    if (data.bills.length == 0) {
        billsData = "There are no bills due within " + data.count + " days";
    }
    else {
        billsData = "There are the bills which are due within next " + data.count + " days:\n\n";
        for (var i = 0; i < data.bills.length; i++) {
            billsData = billsData + "https://" + process.env.DOMAIN_NAME + "/v1/bill/" + data.bills[i].id + "\n"
        }
    }
    console.log("Test results: " + billsData);
    var emailParams = {
        Destination: {
            /* required */
            ToAddresses: [
                data.Email
                /* more items */
            ]
        },
        Message: {
            /* required */
            Body: {
                Text: {
                    Charset: "UTF-8",
                    Data: billsData
                }
            },
            Subject: {
                Charset: "UTF-8",
                Data: "Bill ids which are getting expired"
            }
        },
        Source: "csye6225@" + process.env.DOMAIN_NAME /* required */
    };
    let putParams = {
        TableName: "csye6225",
        Item: {
            id: { S: data.Email },
            bills: { S: billsData },
            ttl: { N: expirationTime }
        }
    };
    let queryParams = {
        TableName: 'csye6225',
        Key: {
            'id': { S: data.Email }
        },
    };
    // first get item and check if email exists
    //if does not exist put item and send email,
    //if exists check if ttl > currentTime,
    // if ttl is greater than current time do nothing,
    // else send email
    ddb.getItem(queryParams, (err, data) => {
        if (err) console.log(err)
        else {
            console.log(data.Item)
            let jsonData = JSON.stringify(data)
            console.log(jsonData)
            let parsedJson = JSON.parse(jsonData);
            console.log(parsedJson)
            if (data.Item == null) {
                ddb.putItem(putParams, (err, data) => {
                    if (err) console.log(err);
                    else {
                        sendEmail(emailParams,data);
                    }
                });
            } else {
                let curr = new Date().getTime();
                let ttl = Number(parsedJson.Item.ttl.N);
                console.log(typeof curr + ' ' + curr);
                console.log(typeof ttl + ' ' + ttl);
                if (curr > ttl) {

                    ddb.putItem(putParams, (err, data) => {
                        if (err) console.log(err);
                        else {
                            sendEmail(emailParams,data);
                        }
                    });
                }
            }
        }
    });
};

function sendEmail(params,data) {
    console.log(data);
    var sendPromise = ses.sendEmail(params).promise();
    sendPromise
        .then(function (data) {
            console.log(data.MessageId);
        })
        .catch(function (err) {
            console.error(err, err.stack);
        });
}