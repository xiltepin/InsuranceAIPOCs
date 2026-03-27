import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomerService } from '../customer.service';

@Component({
  selector: 'app-customer',
  standalone: true,
  imports: [CommonModule],
  providers: [CustomerService],
  template: `
    <div>
      <h1>Customer Information</h1>
      <table>
        <thead>
        <tr>
          <th>ID</th>
          <th>First Name</th>
          <th>Last Name</th>
          <th>Email</th>
          <!-- Add more columns as needed -->
        </tr>
        </thead>
        <tbody>
        <tr *ngFor="let customer of customers">
          <td>{{ customer.customer_id }}</td>
          <td>{{ customer.first_name }}</td>
          <td>{{ customer.last_name }}</td>
          <td>{{ customer.email }}</td>
          <!-- Add more columns as needed -->
        </tr>
        </tbody>
      </table>
    </div>
  `
})
export class CustomerComponent implements OnInit {
  customers: any[] = [];

  constructor(private customerService: CustomerService) { }

  ngOnInit() {
    this.customerService.getCustomers().subscribe(data => {
      this.customers = data;
    });
  }
}
