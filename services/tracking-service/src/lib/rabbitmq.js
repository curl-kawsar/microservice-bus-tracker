import amqp from 'amqplib';

let connection = null;
let channel = null;

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const QUEUE_NAME = 'bus_position_events';
const EXCHANGE_NAME = 'bus_tracking';

export async function initRabbitMQ() {
  try {
    // Retry connection with backoff
    let retries = 5;
    while (retries > 0) {
      try {
        connection = await amqp.connect(RABBITMQ_URL);
        break;
      } catch (err) {
        console.log(`RabbitMQ connection failed, retrying... (${retries} attempts left)`);
        retries--;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    if (!connection) {
      throw new Error('Failed to connect to RabbitMQ after multiple attempts');
    }

    channel = await connection.createChannel();

    // Declare exchange
    await channel.assertExchange(EXCHANGE_NAME, 'fanout', { durable: true });

    // Declare queue
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    // Bind queue to exchange
    await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, '');

    console.log('RabbitMQ connected and queue initialized');

    // Handle connection close
    connection.on('close', () => {
      console.log('RabbitMQ connection closed');
      setTimeout(initRabbitMQ, 5000);
    });

    connection.on('error', (err) => {
      console.error('RabbitMQ connection error:', err);
    });
  } catch (error) {
    console.error('Failed to initialize RabbitMQ:', error);
    // Retry after delay
    setTimeout(initRabbitMQ, 5000);
  }
}

export async function publishPositionEvent(event) {
  try {
    if (!channel) {
      console.error('RabbitMQ channel not available');
      return false;
    }

    const message = JSON.stringify(event);
    channel.publish(EXCHANGE_NAME, '', Buffer.from(message), {
      persistent: true,
    });

    console.log('Position event published:', event.busId);
    return true;
  } catch (error) {
    console.error('Failed to publish position event:', error);
    return false;
  }
}

export function getChannel() {
  return channel;
}

export function getConnection() {
  return connection;
}
