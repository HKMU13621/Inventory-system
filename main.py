from fastapi import FastAPI, Request, Form, Depends, HTTPException, status,UploadFile, File
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.encoders import jsonable_encoder  # Add this import
from pydantic import BaseModel,EmailStr
import json
from datetime import datetime, timedelta,date,timezone
import jwt
from typing import Optional
import shutil
import os
from uuid import uuid4
from typing import List, Dict, Any
import pytz
from passlib.hash import bcrypt
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
HKG_TZ = pytz.timezone('Asia/Hong_Kong')
def get_hk_time():
    """Get current time in Hong Kong timezone"""
    return datetime.now(HKG_TZ)
class SaleItem(BaseModel):
    product_id: str
    quantity: int
    unit_price: float

class SaleCreate(BaseModel):
    items: List[SaleItem]
    customer_name: str
    notes: str = ""

app = FastAPI()
UPLOAD_DIR = "static/uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)
# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Templates
templates = Jinja2Templates(directory="templates")

# Security
SECRET_KEY = "C0mP350F"  # Change in production
ALGORITHM = "HS256"

# Database simulation

def load_database():
    try:
        with open('database.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {"users": {}, "products": {}, "sales": {}}

def save_database(data):
    with open('database.json', 'w') as f:
        json.dump(data, f, indent=4)

# Auth utilities
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=30)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(request: Request):
    try:
        token = request.cookies.get("access_token")
        if not token:
            return None
            
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username = payload.get("sub")
            if username is None:
                return None
        except JWTError:
            return None
            
        db = load_database()
        user = db["users"].get(username)
        if user is None:
            return None
            
        return {
            "username": username,
            "role": user["role"],
            "full_name": user.get("full_name", ""),
            "is_active": user.get("is_active", True)
        }
    except Exception as e:
        print(f"Error in get_current_user: {str(e)}")
        return None
    
def initialize_database():
    try:
        with open('database.json', 'r') as f:
            db = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        db = {}

    # Ensure all required sections exist
    if "users" not in db:
        db["users"] = {}
    if "products" not in db:
        db["products"] = {}
    if "sales" not in db:
        db["sales"] = {}
    
    # Create admin user if it doesn't exist
    if "admin" not in db["users"]:
        db["users"]["admin"] = {
            "email": "admin@example.com",
            "password": hash_password("admin123"),  # Change this password!
            "role": "manager",
            "full_name": "Admin User",
            "is_active": True,
            "created_at": get_hk_time().strftime("%d/%m/%Y")
        }
    
    # Save initialized database
    with open('database.json', 'w') as f:
        json.dump(db, f, indent=4)
    
    return db

def format_sale_data(sale: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure sale data has all required fields"""
    return {
        "id": str(sale.get("id", "")),
        "product_id": str(sale.get("product_id", "")),
        "quantity": int(sale.get("quantity", 0)),
        "total_price": float(sale.get("total_price", 0.0)),
        "date": sale.get("date", datetime.now().isoformat()),
        "status": sale.get("status", "Completed")
    }

# Routes
@app.get("/", response_class=HTMLResponse)
async def root(request: Request, user=Depends(get_current_user)):
    if not user:
        return RedirectResponse(url="/login")
    return RedirectResponse(url="/products")

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

# @app.post("/login")
# async def login(request: Request, username: str = Form(...), password: str = Form(...)):
#     db = load_database()
#     user = db["users"].get(username)
    
#     if not user or user["password"] != password:  # Use proper hashing in production
#         return templates.TemplateResponse(
#             "login.html", 
#             {"request": request, "error": "Invalid credentials"}
#         )
    
#     token = create_access_token({"sub": username, "role": user["role"]})
#     response = RedirectResponse(url="/products", status_code=status.HTTP_302_FOUND)
#     response.set_cookie(key="access_token", value=token)
#     return response

#------------------------------------------------------------------------------------------
#Product System
#------------------------------------------------------------------------------------------
@app.get("/products", response_class=HTMLResponse)
async def products_page(request: Request, user=Depends(get_current_user)):
    if not user:
        return RedirectResponse(url="/login")
    
    try:
        db = load_database()
        # Ensure all product data is properly formatted
        products = {
            str(id): {
                "id": str(id),
                "name": str(product["name"]),
                "description": str(product["description"]),
                "price": float(product["price"]),
                "quantity": int(product["quantity"]),
                "image_path": str(product["image_path"])
            }
            for id, product in db["products"].items()
        }
        
        return templates.TemplateResponse(
            "products.html",
            {
                "request": request,
                "user": user,
                "products": products
            }
        )
    except Exception as e:
        print(f"Error loading products: {e}")
        return templates.TemplateResponse(
            "products.html",
            {
                "request": request,
                "user": user,
                "products": {},
                "error": "Error loading products"
            }
        )
@app.post("/products/add")
async def add_product(
    request: Request,
    name: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    quantity: int = Form(...),
    image: UploadFile = File(...),
    user=Depends(get_current_user)
):
    if not user or user["role"] not in ["sales", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Generate unique filename
    file_extension = os.path.splitext(image.filename)[1]
    unique_filename = f"{uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save uploaded file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)
    
    # Save product to database
    db = load_database()
    product_id = str(uuid4())
    db["products"][product_id] = {
        "id": product_id,
        "name": name,
        "description": description,
        "price": float(price),
        "quantity": int(quantity),
        "image_path": f"/static/uploads/{unique_filename}"
    }
    save_database(db)
    
    return RedirectResponse(url="/products", status_code=status.HTTP_302_FOUND)

@app.post("/products/{product_id}/edit")
async def edit_product(
    product_id: str,
    request: Request,
    name: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    quantity: int = Form(...),
    image: UploadFile = File(None),
    user=Depends(get_current_user)
):
    if not user or user["role"] not in ["sales", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        db = load_database()
        if product_id not in db["products"]:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Update product information
        product = db["products"][product_id]
        product.update({
            "name": name,
            "description": description,
            "price": float(price),
            "quantity": int(quantity)
        })
        
        # Handle new image if uploaded
        if image and image.filename:
            # Remove old image if it exists
            old_image_path = product["image_path"].replace("/static/", "", 1)
            if os.path.exists(old_image_path):
                try:
                    os.remove(old_image_path)
                except Exception as e:
                    print(f"Error removing old image: {e}")
            
            # Save new image
            file_extension = os.path.splitext(image.filename)[1]
            unique_filename = f"{uuid4()}{file_extension}"
            file_path = os.path.join(UPLOAD_DIR, unique_filename)
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer)
            
            product["image_path"] = f"/static/uploads/{unique_filename}"
        
        save_database(db)
        return {"status": "success"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/products/{product_id}")
async def delete_product(product_id: str, user=Depends(get_current_user)):
    if not user or user["role"] not in ["sales", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db = load_database()
    if product_id not in db["products"]:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Remove product image
    image_path = db["products"][product_id]["image_path"].replace("/static/", "", 1)
    if os.path.exists(image_path):
        os.remove(image_path)
    
    # Remove product from database
    del db["products"][product_id]
    save_database(db)
    
    return {"status": "success"}

@app.get("/logout")
async def logout():
    response = RedirectResponse(url="/login")
    response.delete_cookie("access_token")
    return response


#------------------------------------------------------------------------------------------
#sales system
#------------------------------------------------------------------------------------------
@app.get("/sales", response_class=HTMLResponse)
async def sales_page(request: Request, user=Depends(get_current_user)):
    if not user:
        return RedirectResponse(url="/login")
    
    try:
        db = load_database()
        
        # Format products data
        products_data = {}
        for id, product in db.get("products", {}).items():
            try:
                products_data[str(id)] = {
                    "id": str(id),
                    "name": str(product.get("name", "")),
                    "description": str(product.get("description", "")),
                    "price": float(product.get("price", 0.0)),
                    "quantity": int(product.get("quantity", 0)),
                    "image_path": str(product.get("image_path", ""))
                }
            except Exception as e:
                print(f"Error formatting product {id}: {str(e)}")
                continue
        
        # Format sales data with HK timezone
        sales_data = []
        for sale in db.get("sales", {}).values():
            try:
                # Convert UTC time to HK time
                sale_date = datetime.fromisoformat(sale.get("date", ""))
                if sale_date.tzinfo is None:  # If the date has no timezone info
                    sale_date = pytz.utc.localize(sale_date)
                hk_date = sale_date.astimezone(HKG_TZ)

                sales_data.append({
                    "id": str(sale.get("id", "")),
                    "product_id": str(sale.get("product_id", "")),
                    "quantity": int(sale.get("quantity", 0)),
                    "total_price": float(sale.get("total_price", 0.0)),
                    "date": hk_date.strftime("%d/%m/%Y,%H-%M-%S"), # Format date as DD/MM/YYYY
                    "status": sale.get("status", "Completed")
                })
            except Exception as e:
                print(f"Error formatting sale: {str(e)}")
                continue

        # Calculate statistics using HK timezone
        today = get_hk_time().date()
        today_sales = sum(
            sale["total_price"] 
            for sale in db.get("sales", {}).values()
            if datetime.fromisoformat(sale.get("date", "")).astimezone(HKG_TZ).date() == today
        )
        
        total_sales = sum(sale["total_price"] for sale in sales_data)
        total_orders = len(sales_data)

        return templates.TemplateResponse(
            "sales.html",
            {
                "request": request,
                "user": user,
                "products": products_data,
                "sales": sales_data,
                "today_sales": today_sales,
                "total_sales": total_sales,
                "total_orders": total_orders
            }
        )
    except Exception as e:
        print(f"Error in sales_page: {str(e)}")
        return templates.TemplateResponse(
            "sales.html",
            {
                "request": request,
                "user": user,
                "products": {},
                "sales": [],
                "today_sales": 0.0,
                "total_sales": 0.0,
                "total_orders": 0,
                "error": f"Error loading sales data: {str(e)}"
            }
        )

@app.post("/sales/create")
async def create_sale(
    product_id: str = Form(...),
    quantity: int = Form(...),
    user=Depends(get_current_user)
):
    if not user or user["role"] not in ["sales", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        db = load_database()
        
        # Validate product exists
        if product_id not in db["products"]:
            raise HTTPException(status_code=404, detail="Product not found")
        
        product = db["products"][product_id]
        
        # Validate quantity
        if quantity > product["quantity"]:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock. Available: {product['quantity']}"
            )
        
        # Calculate total price
        total_price = float(product["price"]) * quantity
        
        # Create sale record
        sale_id = str(uuid4())
        sale = {
            "id": sale_id,
            "product_id": product_id,
            "quantity": quantity,
            "total_price": total_price,
            "date": get_hk_time().isoformat(),  # Use HK time
            "status": "Completed"
        }
        
        # Update product quantity
        product["quantity"] -= quantity
        
        # Initialize sales in database if needed
        if "sales" not in db:
            db["sales"] = {}
            
        # Save sale
        db["sales"][sale_id] = sale
        save_database(db)
        
        return {"status": "success", "sale_id": sale_id}
        
    except Exception as e:
        print(f"Error creating sale: {str(e)}")
        raise HTTPException(status_code=500, detail="Error creating sale")
@app.get("/debug/database")
async def debug_database(user=Depends(get_current_user)):
    if not user or user["role"] != "manager":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db = load_database()
    return {
        "products_count": len(db.get("products", {})),
        "sales_count": len(db.get("sales", {})),
        "products": db.get("products", {}),
        "sales": db.get("sales", {})
    }

#------------------------------------------------------------------------------------------
#User Role
#------------------------------------------------------------------------------------------

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str
    full_name: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None

class ActivityLog(BaseModel):
    username: str
    action: str
    details: str
    timestamp: datetime
    ip_address: Optional[str] = None

def hash_password(password: str) -> str:
    """Hash a password for storing."""
    return pwd_context.hash(password)

def verify_password(stored_password: str, provided_password: str) -> bool:
    """Verify a stored password against one provided by user"""
    return pwd_context.verify(provided_password, stored_password)

VALID_ROLES = ['manager', 'sales']

# User management routes
async def log_activity(username: str, action: str, details: str, request: Request):
    """Log user activity"""
    try:
        db = load_database()
        
        if "activity_logs" not in db:
            db["activity_logs"] = []
        
        # Add new activity log
        log = {
            "username": username,
            "action": action,
            "details": details,
            "timestamp": get_hk_time().strftime("%d/%m/%Y %H:%M"),
            "ip_address": request.client.host if request.client else None
        }
        
        db["activity_logs"].insert(0, log)
        
        # Keep only last 1000 logs
        db["activity_logs"] = db["activity_logs"][:1000]
        
        save_database(db)
        
    except Exception as e:
        print(f"Error logging activity: {str(e)}")
        
@app.get("/users", response_class=HTMLResponse)
async def users_page(request: Request, current_user=Depends(get_current_user)):
    if not current_user or current_user["role"] != "manager":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        db = load_database()
        
        # Get users
        users_data = []
        for username, user in db.get("users", {}).items():
            users_data.append({
                "username": username,
                "email": user.get("email", ""),
                "role": user.get("role", ""),
                "full_name": user.get("full_name", ""),
                "is_active": user.get("is_active", True),
                "created_at": user.get("created_at", "")
            })
        
        # Get recent activities
        activities = db.get("activity_logs", [])[:50]  # Get last 50 activities
        
        return templates.TemplateResponse(
            "users.html",
            {
                "request": request,
                "users": users_data,
                "activities": activities,
                "valid_roles": VALID_ROLES,
                "current_user": current_user
            }
        )
    except Exception as e:
        print(f"Error in users_page: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
# Add password reset endpoint
@app.post("/users/{username}/reset-password")
async def reset_password(
    username: str,
    request: Request,
    new_password: str = Form(...),
    current_user=Depends(get_current_user)
):
    """Reset user password endpoint"""
    # Check authorization
    if not current_user or current_user["role"] != "manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized. Manager role required."
        )
    
    try:
        # Input validation
        if len(new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters long"
            )
        
        db = load_database()
        
        # Check if user exists
        if username not in db["users"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Update password
        db["users"][username]["password"] = hash_password(new_password)
        save_database(db)
        
        # Log activity
        await log_activity(
            current_user["username"],
            "reset_password",
            f"Reset password for user {username}",
            request
        )
        
        return {"status": "success", "message": "Password reset successfully"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error resetting password: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error resetting password: {str(e)}"
        )
# Add status toggle endpoint
@app.post("/users/{username}/toggle-status")
async def toggle_user_status(
    username: str,
    status_data: dict,
    request: Request,
    current_user=Depends(get_current_user)
):
    if not current_user or current_user["role"] != "manager":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        db = load_database()
        
        if username not in db["users"]:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update status
        db["users"][username]["is_active"] = status_data["is_active"]
        save_database(db)
        
        # Log activity
        status = "activated" if status_data["is_active"] else "deactivated"
        await log_activity(
            current_user["username"],
            f"user_{status}",
            f"{status.capitalize()} user {username}",
            request
        )
        
        return {"status": "success"}
        
    except Exception as e:
        print(f"Error toggling user status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
# User management routes with fixed authorization
@app.post("/users/create")
async def create_user(
    request: Request,
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    full_name: str = Form(...),
    role: str = Form(...)
):
    current_user = await get_current_user(request)
    # if not current_user or current_user["role"] != "manager":
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Not authorized. Manager role required."
    #     )
    
    try:
        db = load_database()
        
        # Check if username already exists
        if username in db.get("users", {}):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )
        
        # Validate role
        if role not in VALID_ROLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role"
            )
        
        # Create new user
        hashed_password = hash_password(password)
        new_user = {
            "email": email,
            "password": hashed_password,
            "full_name": full_name,
            "role": role,
            "is_active": True,
            "created_at": get_hk_time().strftime("%d/%m/%Y")
        }
        
        if "users" not in db:
            db["users"] = {}
        
        db["users"][username] = new_user
        save_database(db)
        
        # Log activity
        await log_activity(
            current_user["username"],
            "create_user",
            f"Created new user {username}",
            request
        )
        
        return {"status": "success", "message": "User created successfully"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error creating user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating user"
        )
@app.put("/users/{username}")
async def update_user(
    username: str,
    request: Request,
    email: str = Form(None),
    full_name: str = Form(None),
    role: str = Form(None)
):
    current_user = await get_current_user(request)
    if not current_user or current_user["role"] != "manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized. Manager role required."
        )
    
    try:
        db = load_database()
        
        if username not in db["users"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_data = db["users"][username]
        
        # Update fields if provided
        if email is not None:
            user_data["email"] = email
        if full_name is not None:
            user_data["full_name"] = full_name
        if role is not None:
            if role not in VALID_ROLES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid role"
                )
            user_data["role"] = role
        
        db["users"][username] = user_data
        save_database(db)
        
        # Log activity
        await log_activity(
            current_user["username"],
            "update_user",
            f"Updated user {username}",
            request
        )
        
        return {"status": "success", "message": "User updated successfully"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error updating user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error updating user"
        )
@app.delete("/users/{username}")
async def delete_user(username: str, request: Request):
    current_user = await get_current_user(request)
    if not current_user or current_user["role"] != "manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized. Manager role required."
        )
    
    if username == current_user["username"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    try:
        db = load_database()
        
        if username not in db["users"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Instead of deleting, deactivate the user
        db["users"][username]["is_active"] = False
        save_database(db)
        
        # Log activity
        await log_activity(
            current_user["username"],
            "deactivate_user",
            f"Deactivated user {username}",
            request
        )
        
        return {"status": "success", "message": "User deactivated successfully"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error deactivating user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error deactivating user"
        )
# Update the login route to check for active status
@app.post("/login")
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    db = load_database()
    user = db["users"].get(username)
    
    if not user or not user.get("is_active", True):
        return templates.TemplateResponse(
            "login.html", 
            {"request": request, "error": "Invalid credentials"}
        )
    
    if not verify_password(user["password"], password):
        return templates.TemplateResponse(
            "login.html", 
            {"request": request, "error": "Invalid credentials"}
        )
    
    access_token = create_access_token({
        "sub": username,
        "role": user["role"]
    })
    
    response = RedirectResponse(url="/products", status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=1800,  # 30 minutes
        samesite="lax"
    )
    return response

# initialize_database()