const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
};

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
    };

    switch (event.requestContext.http.method) {
        case 'OPTIONS':
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify('CORS enabled'),
            };
        case 'GET':
            if (event.requestContext.http.path === '/test') {
                return {
                    statusCode: 200,
                    body: JSON.stringify('Test route works!'),
                    headers,
                };
            } else if (event.requestContext.http.path === '/prod/api/threads') {
                return listThreads(event);
            } else if (event.requestContext.http.path.startsWith('/prod/api/threads/')) {
                const pathSegments = event.requestContext.http.path.split('/');
                const threadId = pathSegments[4];
                if (pathSegments.length < 6) {
                    return getThreadDetails(event, threadId);
                } else if (pathSegments.length === 6 && pathSegments[5] === 'posts') {
                    return listThreadPosts(event, threadId);
                }
            }
            break;
        case 'POST':
            if (event.requestContext.http.path === '/prod/api/threads') {
                return createThread(event);
            } else if (event.requestContext.http.path.startsWith('/prod/api/threads/')) {
                const pathSegments = event.requestContext.http.path.split('/');
                const threadId = pathSegments[4];
                if (pathSegments.length === 6 && pathSegments[5] === 'posts') {
                    const threadId = pathSegments[4];
                    return createThreadPost(event, threadId);
                }
            }
            break;
        case 'DELETE':
            if (event.requestContext.http.path.startsWith('/prod/api/threads/')) {
              const pathSegments = event.requestContext.http.path.split('/');
              const threadId = pathSegments[4];
              if (pathSegments.length === 7 && pathSegments[5] === 'posts') {
                const postId = pathSegments[6];
                return deleteThreadPost(event, threadId, postId);
              }
            }
            break;
        default:
            return {
                statusCode: 400,
                body: JSON.stringify('Unsupported HTTP method'),
                headers,
            };
    }
};


const listThreads = async (event) => {
    const params = {
        TableName: 'MidnightForumThreads',
    };

    try {
        const data = await dynamodb.scan(params).promise();
        const threads = data.Items.map(item => {
            return {
                id: item.PK.replace('THREAD#', ''),
                title: item.title,
                user_id: item.userId, 
                created_at: item.createdAt 
            };
        });


        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(threads),
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: error.message }),
        };
    }
};

const getThreadDetails = async (event, threadId) => {

    try {
        const params = {
            TableName: 'MidnightForumThreads',
            Key: {
                PK: threadId,
            },
        };

        const result = await dynamodb.get(params).promise();

        if (result.Item) {
            return {
                statusCode: 200,
                body: JSON.stringify(result.Item),
            };
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Thread not found' }),
            };
        }
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};

// Fetch all posts of a thread
const listThreadPosts = async (event, threadId) => {

    try {
        const params = {
            TableName: 'MidnightForumPosts',
            IndexName: 'threadIdIndex',  
            KeyConditionExpression: 'threadId = :threadId',
            ExpressionAttributeValues: {
                ':threadId': threadId,
            },
        };

        const result = await dynamodb.query(params).promise();
        return {
            statusCode: 200,
            body: JSON.stringify(result.Items),
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};


// Create a new post in a thread
const createThreadPost = async (event, threadId) => {
    const { id, content, userId } = JSON.parse(event.body);

    try {
        const params = {
            TableName: 'MidnightForumPosts',
            Item: {
                id,
                content,
                user_id: userId,
                threadId,
                created_at: new Date().toISOString(),
            },
        };

        await dynamodb.put(params).promise();
        return {
            statusCode: 201,
            body: JSON.stringify(params.Item),
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};

const createThread = async (event) => {
  const { PK, title, content, userId } = JSON.parse(event.body);
  if (!title || !content || !userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing parameters" }),
    };
  }

  const params = {
    TableName: 'MidnightForumThreads',
    Item: {
      PK,
      SK: new Date().toISOString(),
      title,
      content,
      userId,
      createdAt: new Date().toISOString(),
    },
  };

  try {
    await dynamodb.put(params).promise();
    return {
      statusCode: 201,
      body: JSON.stringify({ message: "Thread created successfully" }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

const deleteThreadPost = async (event, threadId, postId) => {
  try {
    // First, get the post to verify the author
    const getParams = {
      TableName: 'MidnightForumPosts', 
      Key: {
        id: postId,
      },
    };

    const getResult = await dynamodb.get(getParams).promise();
    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Post not found' }),
      };
    }

    const decodedToken = jwt.decode(event.headers.authorization, { complete: true });

    if (getResult.Item.user_id !== decodedToken.payload.name) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Forbidden: Users can only delete their own posts' }),
      };
    }

    // If author matches, proceed to delete the post
    const deleteParams = {
      TableName: 'MidnightForumPosts', 
      Key: {
        id: postId,
      },
    };

    await dynamodb.delete(deleteParams).promise();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Post deleted successfully' }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
