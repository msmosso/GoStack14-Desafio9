import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import ProductsRepository from '@modules/products/infra/typeorm/repositories/ProductsRepository';
import CustomersRepository from '@modules/customers/infra/typeorm/repositories/CustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';
import OrdersRepository from '../infra/typeorm/repositories/OrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject(OrdersRepository)
    private ordersRepository: IOrdersRepository,
    @inject(ProductsRepository)
    private productsRepository: IProductsRepository,
    @inject(CustomersRepository)
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('This customer does not registered');
    }

    const validProducts = await this.productsRepository.findAllById(products);

    if (validProducts.length !== products.length) {
      throw new AppError('Invalid Order');
    }

    products.forEach(product => {
      validProducts.forEach(p => {
        if (p.id === product.id && product.quantity > p.quantity) {
          throw new AppError(`Quantity of ${p.name} is not avaliable`);
        }
      });
    });

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: validProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializedProducts,
    });

    const { order_products } = order;

    const orderProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        validProducts.filter(p => p.id === product.product_id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
